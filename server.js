const express = require('express'),
    request = require('request'),
    bodyParser = require('body-parser'),
    app = express(),
    cors = require('cors'),
    TokenGenerator = require('uuid-token-generator'),
    ejs = require('ejs'),
    jsdom = require('jsdom'),
    cookieParser = require("cookie-parser");
ctypto = require('crypto');
cloudscraper = require('cloudscraper');


const myLimit = typeof (process.argv[2]) != 'undefined' ? process.argv[2] : '100kb';
const {Client} = require('pg');
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
const tokenGenerator = new TokenGenerator();
const offset_number = 10;
const timeout_ms = 5000;

const source_1 = process.env.source_1;
const source_2 = process.env.source_2;

app.use('/public', express.static(__dirname + '/public', {maxAge: 0}));

app.use(cors());
app.use(cookieParser())
app.use(bodyParser.json({limit: myLimit}));
app.use(bodyParser.urlencoded({extended: true})); // support encoded bodies

app.set('view engine', 'ejs');


// ---------return page----------

app.get('/mainPage', async (req, res) => {

    let source = req.cookies.source ? req.cookies.source : source_1;
    source = req.query['_s'] ? req.query['_s'] : source_1;
    let page = req.query.page ? parseInt(req.query.page) : 1;
    let manga_data = {
        'total_page': -1,
        'source_data': []
    };
    let errorMessage = null;

    res.cookie('source', source);

    if (!req.cookies.token) {
        res.redirect('/public/html/loginPage.html');
    }

    if (await verify_token(req.cookies.token)) {
        let response;
        switch (source) {
            case source_1:

                try {
                    response = await passCORS(
                        `https://www.${source_1}.org/albums-index-page-${page}.html`,
                        'GET',
                        {});
                } catch (e) {
                    manga_data['source_data'].push({
                        'source': source,
                        'data': []
                    });
                    errorMessage = 'can not get data';
                    break;
                }

                response = new jsdom.JSDOM(response.body).window.document;

                manga_data['source_data'].push({
                    'source': source,
                    'data': parse_source_1_index(response)
                });
                break;
            case source_2:
                response = await passCORS(
                    `https://${source_2.replace('-', '')}.net/language/chinese/?page=${page}`,
                    'GET',
                    {},
                    req.headers['user-agent']);
                if (Math.floor(response.statusCode / 100) === 5) {
                    errorMessage = '來源伺服器端發生錯誤!';
                }
                response = new jsdom.JSDOM(response.body).window.document;

                manga_data['source_data'].push({
                    'source': source,
                    'data': parse_source_2_index(response)
                });

                break;
            default:
                manga_data['source_data'].push({
                    'source': source,
                    'data': ['no data']
                });
        }

        res.cookie('token', req.cookies.token, {maxAge: 259200000, httpOnly: true, encode: String})

        res.render('index', {
            title: '本本世界',
            manga_data: manga_data,
            page: page,
            source: source,
            router: 'mainPage',
            href_string_before_page: '',
            errorMessage: errorMessage,
            total_page: -1
        });
    } else {
        res.redirect('/public/html/loginPage.html');
    }
})

app.get('/infoPage', async (req, res) => {
    let source = req.query.source;
    let id = req.query.id;

    let name;
    let tags = [];
    let types;
    let total_pages;
    let cover_src;

    let temp;
    let response;
    switch (source) {
        case source_1:
            response = await passCORS(`https://www.${source_1}.org/photos-index-aid-${id}.html`, 'GET', {});
            response = new jsdom.JSDOM(response.body);
            response = response.window.document;

            name = response.getElementsByTagName('h2')[0].innerHTML;
            types = response.getElementsByTagName('label')[0].innerHTML.split('：')[1];
            total_pages = response.getElementsByTagName('label')[1].innerHTML;
            cover_src = response.getElementsByClassName('asTBcell uwthumb')[0].getElementsByTagName('img')[0].src;
            temp = response.getElementsByClassName('tagshow');
            for (let i = 0; i < temp.length; i++) {
                tags.push(temp[i].innerHTML);
            }
            break;

        case source_2:

            response = await passCORS(`https://${source_2.replace('-', '')}.net/g/${id}/`, 'GET', {}, req.headers['user-agent']);
            response = new jsdom.JSDOM(response.body);
            response = response.window.document;

            temp = response.getElementsByClassName('title');
            // for (let i of temp[temp.length - 1].children) {
            //     name += i.innerHTML;
            // }
            name = temp[temp.length - 1].textContent;

            temp = response.getElementsByClassName('tag-container');

            types = temp[0].getElementsByClassName('name')[0];
            types = types ? types.textContent : '';
            total_pages = temp[7].getElementsByClassName('name')[0].innerHTML;
            cover_src = response.getElementById('cover').getElementsByTagName('img')[1].src;
            for (let i of temp[2].getElementsByTagName('a')) {
                tags.push(i.getElementsByClassName('name')[0].innerHTML);
            }
            break;

        default:
    }


    res.render('infoPage', {
        'title': name,
        tags: tags,
        name: name,
        types: types,
        total_pages: total_pages,
        cover_src: cover_src,
        source: source,
        errorMessage: null
    });


})

app.get('/loginPage', (req, res) => {
    res.redirect('page/loginPage.html');
})

app.get('/search', async (req, res) => {
    let search_name = req.query['search_name'];
    let page = req.query.page ? parseInt(req.query.page) : 1;
    let source = req.query.source;
    let search_type = req.query.type;
    let total_page = -1;
    let manga_data = {
        'source_data': []
    }
    let response;

    switch (source) {
        case source_1:
            response = await search_source_1(search_name, page);
            if (response['total_page'] > total_page) {
                total_page = response['total_page'];
            }
            manga_data['source_data'].push({
                'source': source,
                'data': response.data
            })
            break;
        case source_2:

            response = await search_source_2(search_name, page, search_type)
            if (response['total_page'] > total_page) {
                total_page = response['total_page'];
            }

            manga_data['source_data'].push({
                'source': source,
                'data': response.data
            })
            break;
        default:
    }

    // res.cookie('language', language, { maxAge: 900000});
    res.render('index', {
        title: `${search_name} - 本本世界`,
        manga_data: manga_data,
        page: page,
        source: source,
        router: 'search',
        href_string_before_page: `source=${source}&search_name=${search_name}`,
        errorMessage: null,
        total_page: total_page
    });
})

app.get('/bookShelf', async (req, res) => {

    let bookShelfName = req.query.bookshelf ? req.query.bookshelf : '';
    let page = req.query.page ? parseInt(req.query.page) : 1;
    if (!req.cookies.token) {
        res.redirect('/public/html/loginPage.html');
    }

    if (await verify_token(req.cookies.token)) {
        let mangas = await getBookShelfContent(
            req.cookies.token.split('|')[0],
            bookShelfName,
            page);

        res.render('bookShelfPage', {
            'title': 'BookShelf',
            'books': mangas,
            'errorMessage': null,
            'router': 'bookShelf',
            'source': '',
            'href_string_before_page': `bookshelf=${bookShelfName}`,
            'page': page,
            'total_page': mangas[0] ? Math.ceil(mangas[0].totalcount / offset_number) : -1,
            'bookShelf': bookShelfName
        });
    }

})


// ----------api-------------

app.get('/passCORS', function (req, res, next) {


    // Set CORS headers: allow all origins, methods, and headers: you may want to lock this down in a production environment
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET");
    res.header("Access-Control-Allow-Headers", req.header('access-control-request-headers'));

    let targetURL = req.header('Target-Endpoint');

    // if (!targetURL) {
    //     res.send(500, {error: 'There is no Target-Endpoint header in the request'});
    //     return;
    // }


    // for (let i in req.query) {
    //     targetURL += i + '=' + req.query[i] + '&';
    // }

    request({
        url: targetURL.slice(0, -1),
        method: 'GET',
        json: req.body,
        headers: {'Authorization': req.header('Target-Endpoint')}
    }, function (error, response, body) {
        if (error) {
            console.error('error: ' + response.statusCode)
        }
    }).pipe(res);

});

app.post('/login', (req, res) => {

    verify_login(req.body.username, req.body.password)
        .then(
            re => {
                res.cookie(
                    'token', re.token, {
                        maxAge: req.body.rememberMe ? 259200000 : 3600000,
                        httpOnly: true,
                        encode: String
                    }
                )
                res.send(re);
            }
        )
        .catch(err => {
            console.log(err);
            res.send('login failed');
        })
});

app.get('/checkLogin', (req, res) => {
    if (req.cookies.token) {
        verify_token(req.cookies.token)
            .then((re) => {
                if (!re) {
                    res.send(false);
                } else {
                    res.send(true);
                }
            })
            .catch(() => {
                // res.sendFile('html/loginPage.html', {root: __dirname});
                res.send(false);
            })
    } else {
        res.send(false);
    }
})

app.post('/bookshelf', (req, res) => {
    let userID = req.cookies.token.split('|')[0];
    let params = req.body;
    add_bookshelf(userID, params.bookid, params.book_name, params.shelf_name, params.source, params.imgSrc, params.tags)
        .then(() => {
            res.send(true);
        })
        .catch(() => {
            res.send(false);
        })
});

/**
 * @return {Array}
 *
 * @param {String} headers.authorization The token in cookies.
 * @param {String} query.bookshelf The bookshelf name which wants to get.
 *
 */
app.get('/bookshelf', (req, res) => {
    let user_id = req.cookies.token.split('|')[0];
    // let query = 'select "shelfName", "bookID", "bookSource", "addTime" from BookShelf_old where "userID" = $1 order by "addTime"';
    let query = '';

    client.query(query, [user_id])
        .then(results => {
            res.send(results.rows);
        })
})

/**
 * @return {Array} All bookshelf names belong the account.
 *
 * @params {String} The token of the user and set at authorization in headers.
 *
 */
app.get('/bookshelf_name', (req, res) => {
    // let query = 'select distinct "shelfName" from BookShelf_old where "userID" = $1'
    let query = 'select * from getBookShelf($1) as "shelfName"'
    client.query(query, [req.cookies.token.split('|')[0]])
        .then(re => {
            let shelf = [];
            re.rows.forEach(row => {
                shelf.push(row.shelfName);
            })
            res.send(shelf);
        })
        .catch(err => {
            res.send({shelfName: null});
        })
})

/**
 * @return {JSON} There have images_src and manga's name.
 *
 * @param {String} query.source.
 * @param {String} query.id.
 */
app.get('/manga_data', async (req, res) => {
    let source = req.query.source;
    let id = req.query.id;

    let image_src_prefix = 'https:';
    let response_data = {
        'images-src': []
    }
    let images_response;
    let name;

    let file_extension;
    switch (source) {
        case source_1: {

            images_response = passCORS(`https://www.${source_1}.org/photos-webp-aid-${id}.html`);
            let name_response = passCORS(`https://www.${source_1}.org/photos-index-aid-${id}.html`, 'GET', {});

            images_response = await images_response;
            response_data['name'] = images_response.title;
            images_response = images_response.body.match(/(\/\/[^\\]+)/g);

            for (let i = 0; i < images_response.length; i++) {
                images_response[i] = 'https:' + images_response[i];
            }

            response_data['images-src'] = images_response;

            name_response = await name_response;
            name_response = new jsdom.JSDOM(name_response.body);
            response_data['name'] = name_response.window.document.getElementsByTagName('h2')[0].innerHTML;

            break;
        }

        case source_2:
            images_response = passCORS(`https://${source_2.replace('-', '')}.net/g/${id}/`);
            images_response = await images_response;

            images_response = new jsdom.JSDOM(images_response.body).window.document;
            let images = images_response.getElementsByClassName('thumb-container');
            let image_series_id = images[0].getElementsByTagName('img')[1].src.match(/\/(\d+)\//)[1];
            for (let i = 0; i < images.length; i++) {
                file_extension = images[i].getElementsByTagName('img')[1].src.match(/\/[^\/]*\.([^\/]*)$/)[1]
                response_data['images-src'].push(`https://i.${source_2.replace('-', '')}.net/galleries/${image_series_id}/${i + 1}.${file_extension}`);
            }
            name = images_response.getElementsByClassName('title');
            response_data['name'] = name[name.length - 1].textContent;
            break;
    }

    res.send(response_data);
})

/**
 * @return {JSON} The custom tags of this book which are belong to the user.
 *
 * @param {String} token
 * @param {String} query.bookID
 * @param {String} query.bookSource
 */
app.get('/custom_tags', (req, res) => {
    let query = `select *
                 from getUserTags($1, $2, $3)`;
    client.query(query, [req.cookies.token.split('|')[0], req.query.bookid, req.query.source])
        .then((response) => {
            res.send({
                'tags': response.rows["0"].getusertags
            });
        })
        .catch((err) => {
            res.send({'tags': []});
        })
})

app.get('/test', async (req, res) => {
    let result = await getBookAdditionalTags('00001', '133378', source_1);
})
app.get('/test_function', async (req, res) => {

})

app.post('/test', async (req, res) => {
    verify_token(req.cookies.token)
        .then((re) => {
            if (!re) {
                res.send(false);
            } else {
                res.send(true);
            }
        })
        .catch(() => {
            // res.sendFile('html/loginPage.html', {root: __dirname});
            res.send(false);
        })
})


app.post('/img_error', async (req, res) => {
    let params = req.body;
    client.query('call img_error($1,$2,$3)', [params.source, params.bookID, params.ImgSrc])
        .then(() => {
            res.send('ok');
        })
        .catch(err => {
            res.send(err);
        })
})

app.delete('/BookShelf', (req, res) => {
    let userID = req.cookies.token.split('|')[0];
    let bookID = req.query.bookID;
    let bookSource = req.query.bookSource;

    client.query('call deleteBookFromBookShelf($1, $2, $3)', [userID, bookID, bookSource])
        .then((result) => {
            res.send(true);
        })
        .catch((err) => {
            res.send(false);
        })

})

// ----------functions----------
client.connect();

/** @deprecated
 */
function queryDatabase() {
    let query = 'SELECT * FROM "user information";';

    client.query(query)
        .then(res => {
            const rows = res.rows;

            rows.map(row => {
                // console.log(`Read: ${JSON.stringify(row)}`);
            });
        })
        .catch(err => {
            console.log(err);
        });
}


let verify_login = (username, password) => {
    return new Promise((resolve, reject) => {
        // let query = 'select "id" from "user information" where "userName" = $1 and password = $2';
        let query = 'select * from logging_check($1, $2)';
        client.query(query, [username, password])
            .then(res => {
                // resolve(res.rows[0]);
                if (res.rows[0].logging_check) {
                    // let userID = res.rows[0].id;
                    // let userToken = tokenGenerator.generate();
                    // query = 'update "user information new version" set token = $2 where "id" = $1';
                    // client.query(query, [userID, userToken])
                    //     .then(result => {
                    //         console.log('Update completed');
                    //         console.log(`Rows affected: ${result.rowCount}`);
                    //         resolve({'token': userID + '|' + userToken});
                    //     })
                    //     .catch(err => {
                    //         // console.log(err);
                    //         reject('login failed');
                    //         throw err;
                    //     });
                    resolve({'token': res.rows[0].logging_check});
                } else {
                    reject('login failed');
                }
            })
    })
}

let verify_token = (received_token) => {
    return new Promise((resolve, reject) => {
        if (!received_token)
            resolve(false);
        // let userID = received_token.split('|')[0];
        // let userToken = received_token.split('|')[1];

        // let query = 'Select Exists (select id from "user information" where id = $1 and token = $2)';
        let query = 'select * from verify_token($1)';
        client.query(query, [received_token])
            .then(result => {
                if (result) {
                    resolve(result.rows[0].verify_token);
                } else {
                    resolve(false);
                }
            })
            .catch(err => {
                reject(false);
            })
    })

}

let add_bookshelf = (userid, bookid, book_name, shelf_name, source, imgSrc, tags) => {
    return new Promise((resolve, reject) => {
        // let query = 'insert into "BookShelf" values ($1, $2, $3, current_timestamp, $4)';
        let query = 'call insertBookShelf($1, $2, $3, $4, $5, $6, $7)';
        client.query(query, [userid, bookid, book_name, shelf_name, source, imgSrc, tags])
            .then(() => {
                resolve(true);
            })
            .catch(err => {
                reject(err);
            })
    })
};

let getBookShelfContent = (userID, shelfName, page) => {
    return new Promise((resolve, reject) => {
        let query = `select *
                     from getBookShelfContent($1, $2, $3, $4)`;
        client.query(query, [userID, shelfName, page, offset_number])
            .then((response) => {
                resolve(response.rows);
            })
            .catch((err) => {
                reject(err);
            })
    });
}

let getBookAdditionalTags = (userID, bookID, bookSource) => {
    return new Promise((resolve, reject) => {
        let query = `select *
                     from getUserTags($1, $2, $3)`;
        client.query(query, [userID, bookID, bookSource])
            .then((response) => {
                // console.dir(response);
                resolve(response);
            })
            .catch((err) => {
                reject(err);
            })
    })
}

let passCORS = (url, method, parameters, userAgent = null) => {
    return new Promise(((resolve, reject) => {
        request({
            url: url,
            method: method,
            json: parameters,
            headers: {
                'Authorization': url,
                'User-Agent': userAgent
            },
            timeout: timeout_ms
        }, (error, response) => {
            if (error) {
                console.error('error: ', error);
                reject('get data error');
            } else {
                resolve(response);
            }
        })
    }))
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function hashSSHA(password) {
    let salt = crypto.createHash('sha1').update(crypto.randomBytes(8)).digest('base64');
    let hash = crypto.createHash('sha1').update(password + salt);
    return {
        salt: salt,
        encrypted: hash.digest().toString('base64')
    };
}


//------------------for source_1-----------------

function parse_source_1_index(response) {

    let return_data = [];
    let items = response.getElementsByClassName('gallary_item');

    for (let i = 0; i < items.length; i++) {
        let item = items[i];
        try {
            return_data.push({
                'id': item.getElementsByTagName('a')[0].href.match(/aid-(\d*)/)[1],
                'name': item.getElementsByTagName('a')[1].text,
                'info': item.getElementsByClassName('info_col')[0].textContent.replace(/\n/, ' '),
                // 'cover-src': 'https://' + item.getElementsByTagName('img')[0].src.match(/t3.*/)[0],
                'cover-src': 'https://' + item.getElementsByTagName('img')[0].src
            });
        } catch (e) {
            if (item.getElementsByTagName('img')[0].src === '/statics/img/nophoto.gif') {
                return_data.push({
                    'id': item.getElementsByTagName('a')[0].href.match(/aid-(\d*)/)[1],
                    'name': item.getElementsByTagName('a')[1].text,
                    'info': item.getElementsByClassName('info_col')[0].textContent.replace(/\n/, ' '),
                    // 'cover-src': 'https://' + item.getElementsByTagName('img')[0].src.match(/t3.*/)[0],
                    'cover-src': `http://www.${source_1}.org/statics/img/nophoto.gif`
                });
            }
        }

    }

    return return_data;
}

let search_source_1 = (name, page) => {
    return new Promise(async (resolve, reject) => {

        let response = await passCORS(encodeURI(
            `https://www.${source_1}.org/search/index.php?q=${name}&m=&f=_all&s=create_time_DESC&p=${page}`
        ), 'GET', {});

        response = new jsdom.JSDOM(response.body).window.document;

        resolve({
            'data': parse_source_1_index(response),
            'total_page': Math.ceil(
                parseInt(response.getElementsByClassName('result')[0].getElementsByTagName('b')[0].innerHTML) / 20
            )
        });
    });
}

// ----------------end source_1-------------------


//------------------for source_2----------------
function parse_source_2_index(response) {
    let return_data = [];

    let items = response.getElementsByClassName('gallery');
    let item;

    for (let i = 0; i < items.length; i++) {
        item = items[i];
        return_data.push({
            'id': item.getElementsByTagName('a')[0].href.match(/\/(\d*)\//)[1],
            'name': item.getElementsByClassName('caption')[0].innerHTML,
            'info': '',
            'cover-src': item.getElementsByTagName('img')[1].src
        })
    }

    return return_data;
}

let search_source_2 = (name, page, type = null, userAgent = null) => {
    return new Promise(async (resolve, reject) => {
        let response;
        if (type) {
            name = name.replace(/ /g, '-')
            response = await passCORS(
                encodeURI(
                    `https://${source_2.replace('-', '')}.net/${type}/${name}/?page=${page}`
                ), 'GET', {}, userAgent);
        } else {
            name = name.replace(/ /g, '+')
            response = await passCORS(
                encodeURI(
                    `https://${source_2.replace('-', '')}.net/search/?q=${name}&page=${page}`
                ), 'GET', {}, userAgent);
        }

        response = new jsdom.JSDOM(response.body).window.document;
        let temp = response.querySelectorAll('.pagination a');

        resolve({
            'data': parse_source_2_index(response),
            'total_page': temp[temp.length - 3] ? temp[temp.length - 3].textContent : 1
        });

    })
}

//----------------------------------------------


// ------Deprecated---------------
app.get('/mainPage_old', (req, res) => {

    if (req.query.page) {
        res.redirect('page/mainPage.html?page=' + req.query.page);
    } else {
        res.sendFile('html/mainPage.html', {root: __dirname});
    }

})
app.get('/infoPage_previous', (req, res) => {

    let redirect_link = 'page/infoPage.html?';
    Object.entries(req.query).forEach(([key, value]) => {
        redirect_link += key + '=' + value + '&'
    })
    // res.sendFile(response_file, {root: __dirname})
    res.redirect(redirect_link.slice(0, -1))
})

// -------------------------------
app.set('port', process.env.PORT || 3000);

app.listen(app.get('port'), function () {
    console.log('Proxy server listening on port ' + app.get('port'));
});

