// window.addEventListener('load', function () {
//     // let href_prefix = '/mainPage?page='
//     // Fetch all the forms we want to apply custom Bootstrap validation styles to
//
//     // Loop over them and prevent submission
//
//     document.getElementById('page-input').addEventListener('keyup', (event) => {
//         if (event.keyCode === 13) {
//             if (location.search.match('page')) {
//                 location.href =
//                     location.pathname + document.location.search.replace(/page=\d*/, 'page=') + event.target.value;
//             } else {
//                 window.location.href = location.href + `&page=${event.target.value}`;
//             }
//
//         }
//     });
//
// });


function addBook2DB(BookID, source) {
    let add_request = window.indexedDB.open('OpenBook', 1);
    let add_db;

    add_request.onerror = () => {
        console.log('connect error');
    };

    add_request.onsuccess = () => {
        console.log('connect success');
        add_db = add_request.result;

        let insert_transaction = add_db.transaction(['BookList'], 'readwrite');
        insert_transaction.oncomplete = () => {
            console.log('All done');
        };

        insert_transaction.onerror = (error) => {
            console.log('occurred error');
            console.log(error);
        };

        let insert_objectStore = insert_transaction.objectStore("BookList");

        let insert_request = insert_objectStore.add(
            {
                BookID: source + '|' + BookID,
                exp: Date.now()
            }
        );
    };
}

function contextmenu_event(item) {
    addBook2DB(item.dataset.id, item.dataset.source);
}

if (location.pathname === '/search') {
    let source = location.search.match(/source=(.*)&/)[1];
    switch (source) {
        case 'srouce_1':
            document.getElementById('searching-show-button').innerText = 'source_1';
            break;
        default:
            document.getElementById('searching-show-button').innerText = source;
    }
    document.getElementById('searching-show-button').dataset.source = source;
}




