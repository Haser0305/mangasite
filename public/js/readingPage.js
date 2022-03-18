let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);

let source = urlParams.get('source');
let id = urlParams.get('id');
let book_name = '';

let images_src = []
let total_images;
let load_finished_image = 0;
let parallel_images = 1;

let tab_id = `${source}-${id}`;
let tab_index = null; // check current index immediately.
let latest_loading_image_index = 0; // to record the last loaded img index.
let latest_loading_success_index = 1;
let last_loading_index = 0;

let subtract_total_pages = false;   //deprecated
let remove_book_from_list = false;  //deprecated
let load_images_bool = false;   // if false, stop loading images.

let error_cnt = 0;  //count how many failed load images.
let source_tabs = null;   //another method to update tabs.
let fail_loading_images_buffer = [];    // for reload failed images. [img_id, img_src]
let fail_loading_images_record = [];    // record failed img_id.
let unloaded_images = [];

let long_manga_count = 50;

let debug = false;

const source_1 = 'source_1';    // fill source1 into here.
const source_2 = 'source_2';    // fill source2 into here.


// new version for update localstorage

/**
 * add tab information into waiting tabs in localstorage and update it.
 * @param {array.<Object>} waiting_tabs
 */
function add_to_waiting_tabs(waiting_tabs = null) {
    // if (!waiting_tabs)
    //     waiting_tabs = JSON.parse(localStorage.getItem(source + '-waiting-tabs'));
    // waiting_tabs.push({
    //     'tab-id': tab_id,
    //     'access-time': Math.round(Date.now() / 1000),
    //     'long-works': total_images > 50
    // });
    // localStorage.setItem(source + '-waiting-tabs', JSON.stringify(waiting_tabs));

    localStorage.setItem('waiting-tab-' + tab_id, JSON.stringify({
        'tab-id': tab_id,
        'access-time': Math.round(Date.now() / 1000),
        'long-works': total_images > long_manga_count
    }))
}

/**
 * @param {array}search_list
 * @param {String}tabID
 * @returns {number}
 */
function get_tab_index(
    search_list = JSON.parse(localStorage.getItem(source + '-tabs')),
    tabID = tab_id) {

    return search_list.map(e => e['tab-id']).indexOf(tabID);
}

function update_source_tabs() {
    console.warn('update local storage');
    localStorage.setItem(source + '-tabs', JSON.stringify(source_tabs));
}

async function get_data(id, source) {
    let response = await axios.get(`/manga_data?source=${source}&id=${id}`);
    total_images = response.data['images-src'].length;
    book_name = response.data['name'];
    document.title = book_name;
    images_src = response.data['images-src'];
}

async function register_host(host_register_id = id) {
    // if (host_register_id > id)
    //     return;
    console.warn('try to become host.');
    let trying_host_tab = localStorage.getItem(source + 'host-register');
    if (trying_host_tab) {
        return;
    }
    console.log(host_register_id);
    localStorage.setItem(source + '-host-register', host_register_id);
    await sleep(1500);

    if (localStorage.getItem(source + '-host-register') === host_register_id) {
        // register host success, init source_tabs.
        source_tabs[0] = {
            'tab-id': tab_id,
            'access-time': Math.round(Date.now() / 1000),
            'long-works': total_images > 50
        };
        tab_index = 0;
        update_source_tabs();
        localStorage.setItem(source + '-host-register', '');
    } else {
        console.warn('become host failed.');
    }
}

function update_tab_index_in_page() {
    console.log('update index in page.');
    if (tab_index === -1)
        document.title = book_name;
    else
        document.title = `(${latest_loading_success_index}/${total_images})[${tab_index}] ${book_name}`;
    document.getElementById('current-tab-index').innerText = tab_index;
    last_loading_index = latest_loading_image_index;
}

let update_index_interval = setInterval(update_tab_index_in_page, 5000);

async function sleep(ms = 0) {
    return new Promise(r => setTimeout(r, ms));
}

function mark_tab_finished() {
    if (tab_index === 0) {
        source_tabs.splice(0, 1);
        update_source_tabs();
    } else {
        localStorage.setItem(tab_id + '-finished', tab_id);
    }
    tab_index = -1;

    // update_source_tabs();
    update_tab_index_in_page();
    clearInterval(update_index_interval);
}

/**
 * collect all waiting tabs with the same source to this tab;
 * @returns {*[]}
 */
function collect_all_waiting_tabs() {
    let result = [];
    for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i).includes('waiting-tab-' + source)) {
            result.push(JSON.parse(localStorage.getItem(localStorage.key(i))))
        }
    }
    return result;
}

function collect_and_update_finished_tabs() {
    let finished_tabs = [];
    for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i).includes('-finished')) {
            finished_tabs.push(localStorage.getItem(localStorage.key(i)));
        }
    }

    for (let tab of finished_tabs) {
        let delete_tab_index = get_tab_index(source_tabs, tab);
        if (delete_tab_index !== -1) {
            source_tabs.splice(delete_tab_index, 1);
        }
        localStorage.removeItem(tab + '-finished');
    }
    update_source_tabs();
}

/**
 * move back long manga.
 */
function reorder_source_tabs() {
    let new_order = [];
    let long_works = [];
    for (let tab of source_tabs) {
        if (tab['long-works']) {
            long_works.push(tab);
        } else {
            new_order.push(tab);
        }
    }

    source_tabs = new_order.concat(long_works);
}

//end ---------------------------------------


async function img_error(source, id, this_img) {
    if (error_cnt === 10) {
        await axios.post('/img_error', {
            "source": source,
            "bookID": id,
            "ImgSrc": this_img.src
        }).then(res => {
            console.log(res);
        })
    }
}


/**
 * @deprecated
 */
function add_tab_into_source_tabs() {
    let index = get_tab_index();
    if (index !== -1) {
        source_tabs.splice(index, 1);
    }
    tab_index = source_tabs.length + 1;
    document.getElementById('current-tab-index').innerText = tab_index;
    console.warn(`tab index: `, tab_index);
    source_tabs.push({
        'tab-id': tab_id,
        'access-time': Math.round(Date.now() / 1000),
        'long-works': total_images > 50
    });
}

function push_book_into_array() {
    source_tabs = JSON.parse(localStorage.getItem(source + '-tabs'));
    console.dir(source_tabs);
    if (source_tabs === null) {
        source_tabs = [];
    }
    // all_tabs.push(tab_id)
    add_tab_into_source_tabs();
    update_source_tabs();
    console.dir(source_tabs)
}

function check_short_works() {
    let short_works = false;
    for (let item of source_tabs) {
        if (!item['long-works']) {
            short_works = true;
            break;
        }
    }

    return short_works;
}

/**
 * @deprecated
 * @param tab_index_set_value
 */
function remove_book_from_local_storage(tab_index_set_value = -1) {
    console.warn('called remove function')
    if (tab_index_set_value !== -2) {
        document.title = book_name;
    }
    if (tab_index > -1) {
        source_tabs.splice(tab_index, 1);
        delete_zombie_tab();
        tab_index = tab_index_set_value;
    }
    document.getElementById('current-tab-index').innerText = tab_index_set_value;
}

function delete_zombie_tab() {
    let index = source_tabs.length - 1;
    while (index >= 0) {
        if ((Math.round(Date.now() / 1000) - source_tabs[index]['access-time']) > 90) {
            source_tabs.push({
                'tab-id': source_tabs[index]['tab-id'],
                'access-time': Math.round(Date.now() / 1000),
                'long-works': total_images > 50
            })
            source_tabs.splice(index, 1);
        }
        index -= 1;
    }
    update_source_tabs();
}


function create_image() {
    let inserted_div = document.getElementById('image-content');
    for (let i = 0; i < images_src.length; i++) {
        let new_div = document.createElement('div');
        let new_img = document.createElement('img');
        let new_page_p = document.createElement('p');
        new_div.className = 'image-container';
        new_img.className = 'image';
        new_img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs%3D';
        new_img.id = 'img' + i;
        new_img.alt = 'img' + i;
        new_img.dataset.loading = 'false';
        new_img.referrerPolicy = 'no-referrer';
        new_page_p.className = 'page';
        new_page_p.id = 'page-' + i;
        new_page_p.innerHTML = (i + 1) + '/' + total_images;
        new_img.onerror = 'img_error(source, id, this)';
        new_div.append(new_img, new_page_p);
        inserted_div.append(new_div);
    }
}

function check_load_all_images() {
    let images = document.querySelectorAll('img.image');
    for (let i of images) {
        if (i.dataset.loading === 'false') {
            unloaded_images.push(i.id);
        }
    }
    return !unloaded_images.length;
}

function load_images(image_index) {
    if (load_finished_image === total_images) {
        if (check_load_all_images()) {
            mark_tab_finished();
            return;
        } else {
            load_finished_image++;
            load_images(parseInt(unloaded_images.shift().match(/img(\d*)/)[1]));
            return;
        }
    }

    let load_image = document.getElementById('img' + image_index);
    if (!load_image)
        return;

    load_image.onload = (e) => {
        load_finished_image += 1;
        e.currentTarget.dataset.loading = 'true';
        latest_loading_success_index = parseInt(e.currentTarget.id.match(/\d+/)[0]) + 1;
        if (fail_loading_images_record.includes(e.target.id)) {
            let next_data = fail_loading_images_buffer.shift();
            setTimeout(() => {
                document.getElementById(next_data[0]).src = next_data[1];
            }, 300);
        } else if (unloaded_images.includes(e.target.id)) {
            setTimeout(() => {
                let image_id = parseInt(unloaded_images.shift().match(/img(\d*)/)[1]);
                if (!image_id) {
                    remove_book_from_local_storage();
                    return;
                }
                console.warn('load unloaded image: ', image_id);
                load_images(image_id);
            }, 300);
        } else if (e.currentTarget.id !== 'img0') {
            load_next_image_new_version(image_index);
        }
    };

    load_image.onerror = async (e) => {
        console.log(load_image);
        error_cnt += 1;
        fail_loading_images_record.push(e.target.id);
        await img_error(source, id, load_image);
        if (error_cnt < 3) {
            setTimeout(() => {
                e.target.src = e.target.src;
            }, 300);
        } else {
            fail_loading_images_buffer.push([e.target.id, e.target.src]);
        }

    }

    // update title and access-time every 5 images loaded.
    if ((image_index + 1) % 5 === 0) {
        // if ((total_images - latest_loading_image_index) > 50) {
        //     if (check_short_works()) {
        //         remove_book_from_local_storage(-2);
        //         update_source_tabs();
        //         // latest_loading_image_index -= 1;
        //         load_images_bool = false;
        //     }
        // }
        // console.dir(source_tabs);
        // console.dir(tab_index);

        // if (source_tabs[tab_index]['tab-id'] !== tab_id) {
        //     alert('tab index is wrong.');
        // } else {
        //     source_tabs[tab_index]['access-time'] = Math.round(Date.now() / 1000);
        // }
        // update_source_tabs();
    }

    if (latest_loading_image_index < image_index) {
        latest_loading_image_index = image_index;
    }

    load_image.src = images_src[image_index];
}

/**
 * store pageIDs as array
 */
function load_next_image_new_version(image_index) {
    let next_image_index = image_index + parallel_images;
    let upper_bound;
    let lower_bound;
    let random_waiting_time;

    if (tab_index === 0) {
        if (source_tabs.length === 1) {
            lower_bound = 100;
            upper_bound = 300;
        }
    } else {
        if (tab_index > 2 || tab_index === null) {
            load_images_bool = false;
            console.warn('stop loading');
            clearInterval(update_index_interval);
            return;
        }
    }

    switch (source) {
        case source_1:
            if (tab_index < 4) {
                lower_bound = 50;
                upper_bound = 150;
            } else {
                lower_bound = 500;
                upper_bound = 3000;
            }

            switch (true) {
                case (next_image_index < 30):
                    lower_bound += 50;
                    upper_bound += 100;
                    break;
                case (next_image_index < 100):
                    lower_bound += 200;
                    upper_bound += 400;
                    break;
                case (next_image_index < 200):
                    lower_bound += 400;
                    upper_bound += 700;
                    break;
                default:
                    lower_bound += 500;
                    upper_bound += 1000;
            }
            break;
        case source_2:
            if (tab_index < 3) {
                lower_bound = 50;
                upper_bound = 150;
            } else {
                lower_bound = 1000;
                upper_bound = 5000;
            }

            switch (true) {
                case (next_image_index < 30):
                    lower_bound += 150;
                    upper_bound += 350;
                    break;
                case (next_image_index < 100):
                    lower_bound += 300;
                    upper_bound += 600;
                    break;
                case (next_image_index < 200):
                    lower_bound += 500;
                    upper_bound += 900;
                    break;
                default:
                    lower_bound += 1000;
                    upper_bound += 1500;
            }
            break;
    }

    random_waiting_time = Math.floor(Math.random() * (upper_bound - lower_bound) + lower_bound);
    // console.dir(`lower bound: ${lower_bound}  upper bound: ${upper_bound}`);
    // console.warn(`waiting time: ${random_waiting_time}`)

    if (!load_images_bool) {
        load_images_bool = true;
        update_index_interval = setInterval(update_tab_index_in_page, 5000);

    }

    if (debug) {
        window.setTimeout(() => {
            console.log('next image index ', next_image_index);
            load_images(next_image_index);
        }, 20000);
    } else {
        window.setTimeout(() => {
            load_images(next_image_index);
        }, random_waiting_time);
    }


}


window.onbeforeunload = () => {
    if (tab_index !== -1) {
        mark_tab_finished();
    }
}

/**
 * update source_tabs if other tab push or delete.
 * @param event
 */
window.onstorage = async (event) => {
    console.log('get new value', event);
    console.warn('key: ', event.key);
    console.log('value', event.newValue);
    if (tab_index === 0) {
        //this tab is host.
        if (event.key === source + '-tabs') {
            // should not have happened.
            tab_index = get_tab_index(JSON.parse(event.newValue));
            if (tab_index === 0) {
                console.error('should not get source-tabs update event in host page.');
                console.error(event.newValue);
            } else {
                update_tab_index_in_page();
            }
        } else if (event.key.includes('waiting-tab-' + source)) {
            // move tabs from waiting list to source list.
            if (event.newValue === null)
                return;
            let new_value = JSON.parse(event.newValue);
            if (get_tab_index(source_tabs, new_value['tab-id']) === -1) {
                source_tabs.push(new_value);
            }
            reorder_source_tabs();
            tab_index = get_tab_index(source_tabs, tab_id);
            update_tab_index_in_page();
            update_source_tabs();
            localStorage.removeItem(event.key);
        } else if (event.key === source + '-host-register') {
            localStorage.removeItem(source + '-host-register')
            console.warn('host is alive');
        } else if (event.key.includes('finished') && event.key.includes(source)) {
            let delete_tab_index = get_tab_index(source_tabs, event.newValue);
            if (delete_tab_index !== -1) {
                source_tabs.splice(delete_tab_index, 1);
            }
            localStorage.removeItem(event.key);
            delete_zombie_tab();
        }

    } else if (tab_index === null || tab_index > 0) {
        // this tab is client.
        if (event.key === source + '-tabs') {

            tab_index = get_tab_index(JSON.parse(event.newValue));
            source_tabs = JSON.parse(event.newValue);

            if (tab_index === -1) {
                // not found in source tabs, init tab_id.
                tab_index = null;
                let check_in_waiting_tabs = false;
                for (let i = 0; i < localStorage.length; i++) {
                    if (localStorage.key(i) === source + '-waiting-tab-' + tab_id) {
                        check_in_waiting_tabs = true;
                        break;
                    }
                }
                if (!check_in_waiting_tabs)
                    add_to_waiting_tabs();
            } else if (tab_index === 0) {
                let all_waiting_tabs = collect_all_waiting_tabs();
                for (let tab of all_waiting_tabs) {
                    if (get_tab_index(source_tabs, tab['tab-id']) === -1) {
                        source_tabs.push(tab);
                    }
                }
            }

            if (!load_images_bool) {
                for (let i = 0; i < parallel_images; i++) {
                    load_next_image_new_version(latest_loading_image_index - i);
                }
            }
            update_tab_index_in_page();
        } else if ((event.key === source + '-host-register') && (event.newValue !== '')) {
            // await register_host();
        }
    }
}


document.querySelector('#btn-back-to-previous-page').addEventListener('click', function () {
    location.href = `/infoPage?source=${source}&id=${id}`
})


// use bookID and bookSource to get images url.
get_data(id, source).then(async () => {

    try {
        source_tabs = JSON.parse(localStorage.getItem(source + '-tabs'));
    } catch (e) {
        if (e instanceof SyntaxError) {
            localStorage.setItem(source + '-tabs', '[]');
            source_tabs = [];
        }
    }
    if (source_tabs === null)
        source_tabs = [];
    await register_host();
    if (tab_index === null) {
        add_to_waiting_tabs();
    } else {
        // become host tab.
        let remove_list = [];
        for (let tab of collect_all_waiting_tabs()) {
            if (get_tab_index(source_tabs, tab['tab-id']) === -1) {
                source_tabs.push(tab);
                remove_list.push('waiting-tab-' + tab['tab-id']);
            } else {
                remove_list.push('waiting-tab-' + tab['tab-id']);
            }
        }
        update_source_tabs();
        for (let i of remove_list) {
            localStorage.removeItem(i);
        }
    }

    collect_and_update_finished_tabs();

    create_image(images_src);
    load_images_bool = true;
    load_images(0);

    update_tab_index_in_page();
    load_images_bool = false;


    if (tab_index === 0) {
        for (let i = 0; i < parallel_images; i++) {
            load_next_image_new_version(latest_loading_image_index - i);
        }
    }
})


