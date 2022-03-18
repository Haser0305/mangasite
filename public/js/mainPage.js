const web_data = {
    source_1: {
        'domain': 'http://www.source-1.org/',
        'page-prefix': 'albums-index-page-'
    }
};

const parser = new DOMParser();
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

let page = urlParams.get('page');

window.addEventListener('load', function () {
    // Fetch all the forms we want to apply custom Bootstrap validation styles to
    var forms = document.getElementById('name-search');
    // Loop over them and prevent submission
    forms.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // searchByName(documentn.getElementById)
        searchByName(
            document.getElementById('name-search').getElementsByTagName('input')[0].value
        )
    })

    setPageNavigation(page);
    getMangaData('source_1', page).then(r => {
        createGalleryItem(r);
    })

    // let container = document.getElementById('container');
    // let gallery_row = document.createElement('div');
    // gallery_row.className = 'row row-cols-2 row-cols-md-5 g-4';
    // container.append(gallery_row);

});


function searchByName(name) {
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}


async function getMangaData(domain, page, params = null) {
    if (!page) {
        page = 1;
    }
    let web = web_data[domain];
    // let response = await axios.get(web['domain'] + web['page-prefix'] + page, {
    //     'headers': params
    // });

    let login = await axios.get('https://manga-viewer-1156.herokuapp.com/checkLogin', {headers: {'Authorization': getCookie('token')}});
    if (login.data) {
        let now = new Date();
        now.setTime(now.getTime() + 604800000);
        document.cookie = `token=${getCookie('token')};path=/;Expires=${now.toUTCString()}`;
        let response = await axios.get('https://manga-viewer-1156.herokuapp.com/passCORS', {
                headers: {
                    'Target-Endpoint': web['domain'] + web['page-prefix'] + page,
                    'Cache-Control': 'no-cache'
                }
            }
        )

        response = parser.parseFromString(response['data'], 'text/html');
        switch (domain) {
            case 'source_1':
                let items = response.getElementsByClassName('gallary_item');
                let return_data = {
                    'source': 'source_1',
                    'data': []
                };
                for (let i = 0; i < items.length; i++) {
                    let item = items[i];
                    return_data['data'].push({
                        'id': item.getElementsByTagName('a')[0].href.match(/aid-(\d*)/)[1],
                        'name': item.getElementsByTagName('a')[1].text,
                        'info': item.getElementsByClassName('info_col')[0].textContent.replace(/\n/, ' '),
                        'cover-src': 'http://' + item.getElementsByTagName('img')[0].src.match(/t3.*/)[0],
                        'source': 'source_1'
                    });
                }
                return return_data;
            default:
                console.log('error');
        }
    } else {
        window.location.href = '/loginPage';
    }


}


function createGalleryItem(allImages) {
    for (let i = 0; i < allImages.data.length; i++) {
        let data = allImages.data[i];
        let insert_col = document.createElement('div');
        let page_link = document.createElement('a');
        let cover = document.createElement('img');
        let body = document.createElement('div');
        let title = document.createElement('p');
        let info = document.createElement('p');

        insert_col.className = 'card h-80';
        // cover.className = 'card-img-top';
        body.className = 'card-body';
        title.className = 'card-title';
        info.className = 'card-text';

        // page_link.href = '/infoPage?id=' + data['id'] + '&source=' + data['source'];
        page_link.href = '/infoPage?source=' + data['source'] + '&id=' + data['id'];
        cover.src = data['cover-src'];
        title.innerText = data['name'];
        info.innerText = data['info'];

        body.append(title, info);
        page_link.append(cover, body);
        // insert_col.append(page_link, body);

        let col = document.createElement('div');
        col.className = 'col';

        col.append(page_link);

        document.getElementById('gallery-row').append(col);
    }

}


function setPageNavigation(page) {
    if (!page) {
        page = 1;
    }
    page = parseInt(page, 10);
    console.log(typeof (page));
    // let pages = [];
    let href_prefix = '/mainPage?page='

    let page_navigations = document.getElementsByClassName('page-link');

    page_navigations[0].href = href_prefix + (page - 1);
    page_navigations[1].href = href_prefix + (page + 1);

    document.getElementById('page-input').value = page;

    document.getElementById('page-input').addEventListener('keyup', (event) => {
        if (event.keyCode === 13) {
            window.location.href = href_prefix + event.target.value;
        }
    })

    // let page_navigations = document.getElementsByClassName('page-item');
    // let page_links = document.getElementsByClassName('page-link');
    // if (page === 1) {
    //     // pages = [1, 2, 3];
    //     page_navigations[0].classList.add('disabled');
    //     page_navigations[1].classList.add('active');
    //     page_links[1].innerText = (page);
    //     page_links[2].innerText = (page + 1);
    //     page_links[3].innerText = (page + 2);
    //     page_links[1].href = href_prefix + (page);
    //     page_links[2].href = href_prefix + (page + 1);
    //     page_links[3].href = href_prefix + (page + 2);
    // } else {
    //     // pages = [page - 1, page, page + 1];
    //     page_navigations[2].classList.add('active');
    //     page_links[1].innerText = (page - 1);
    //     page_links[2].innerText = (page);
    //     page_links[3].innerText = (page + 1);
    //     page_links[1].href = href_prefix + (page - 1);
    //     page_links[2].href = href_prefix + (page);
    //     page_links[3].href = href_prefix + (page + 1);
    // }
    //
    // page_links[0].href = page_links[1].href;
    // page_links[4].href = page_links[3].href;

}

