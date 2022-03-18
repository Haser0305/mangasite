const source = urlParams.get('source');
const id = urlParams.get('id');

window.onload = () => {

    document.getElementById('read-a-tag').href = '/public/html/readingPage.html?source=' + source + '&id=' + id;

    document.getElementById('add_bookshelf_btn').addEventListener('click', async () => {
        // axios.post('/bookshelf', {
        //     "bookid": id,
        //     "shelf_name": document.getElementsByTagName('select')[0].value,
        //     "source": source
        // }, {
        //     headers: {'Authorization': getCookie('token')}
        // }).then(() => {
        //     message_alert('添加成功');
        // })

        await add_bookshelf(
            document.querySelectorAll('#div-name p')[1].innerHTML,
            document.getElementsByTagName('select')[0].value,
            document.querySelector('#cover-image').src
        );
        message_alert('添加成功');
    });

    document.getElementById('bookshelf_dialog').addEventListener('show.bs.modal', () => {
        getBookshelf();
    })

    document.getElementById('new-bookshelf-name').addEventListener('keyup', (event) => {
        if (event.keyCode === 13) {
            document.getElementById('new-bookshelf-btn').click();
        }
    })

    document.getElementById('new-bookshelf-btn').addEventListener('click', async () => {
        let new_bookshelf_name = document.getElementById('new-bookshelf-name').value;

        // axios.post('/bookshelf', {
        //     "bookid": id,
        //     "shelf_name": new_bookshelf_name,
        //     "source": source
        // }, {
        //     headers: {'Authorization': getCookie('token')}
        // }).then(() => {
        //     message_alert('添加成功');
        //     document.getElementById('add-bookshelf-cancel-btn').click();
        // })

        await add_bookshelf(
            document.querySelectorAll('#div-name p')[1].innerHTML,
            new_bookshelf_name,
            document.querySelector('#cover-image').src
        );
        message_alert('添加成功');
        document.getElementById('add-bookshelf-cancel-btn').click();
    });

    // add click listener for searching by type.
    document.querySelectorAll('.type-link').forEach(type => {
        if (source === 'source_2') {
            type.href = `search?source=${source}&search_name=${type.innerText}&type=parody`;
        } else {
            type.href = `search?source=${source}&search_name=${type.innerText}`;
        }
    });


    // add listener for searching by tag.
    document.querySelectorAll('.tag-link').forEach(tag => {
        if (source === 'source_2') {
            tag.href = `search?source=${source}&search_name=${tag.innerText}&type=tag`;
        } else {
            tag.href = `search?source=${source}&search_name=${tag.innerText}`;
        }

    })

    check_redirect_to_readingPage();

}


function message_alert(message) {
    let modal = new bootstrap.Modal(document.getElementById('message-alert'));
    document.getElementById('alert-message-body').innerHTML = message;
    modal.show();
}

function getBookshelf() {
    axios.get('/bookshelf_name', {headers: {'Authorization': getCookie('token')}})
        .then(response => {
            let selection = document.getElementsByTagName('select')[0];
            if (response.data.length) {
                selection.innerHTML = '';
            }
            response.data.forEach(option => {
                let new_option = document.createElement('option');
                new_option.innerHTML = option;
                selection.appendChild(new_option);
            });
        })
}

let add_bookshelf = (bookName, bookShelfName, imgSrc) => {
    let tags =[];
    for(let tag of document.querySelectorAll('.tag-button')) {
        tags.push(tag.innerText);
    }

    return new Promise((resolve => {
        axios.post('/bookshelf', {
            "bookid": id,
            "book_name": bookName,
            "shelf_name": bookShelfName,
            "source": source,
            "imgSrc": imgSrc,
            "tags": tags
        }, {
            headers: {'Authorization': getCookie('token')}
        }).then(response => {
            resolve(resolve);
        })
    }))
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function check_redirect_to_readingPage() {
    let search_request = window.indexedDB.open('OpenBook', 1);
    let search_db;

    search_request.onerror = () => {
        console.log('connect error');
    };

    search_request.onsuccess = () => {
        console.log('connect success');

        search_db = search_request.result;

        let transaction = search_db.transaction(["BookList"], 'readwrite');
        let objectStore = transaction.objectStore("BookList");
        let request_read = objectStore.get(`${source}|${id}`);

        request_read.onerror = function (event) {
            console.log('get error: ' + event);
        };

        request_read.onsuccess = function (event) {
            if (request_read.result) {
                console.log(request_read.result);

                let delete_request = objectStore.delete(`${source}|${id}`);

                delete_request.onsuccess = async function (event) {
                    // It's gone!
                    console.log('delete data');
                    console.log(event);

                    location.href = '/public/html/readingPage.html?source=' + source + '&id=' + id;

                    // window.history.pushState(null, null, 'test.html');
                    // await sleep(3000);
                    // document.querySelector('#read-a-tag').click();
                };
            }
        };
    };
}

