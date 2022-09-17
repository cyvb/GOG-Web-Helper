// ==UserScript==
// @name           GOG Web Helper
// @version        0.1.6
// @namespace      cyvb
// @author         cyvb
// @description    Useful GOG tools on product page.
// @updateURL      https://raw.githubusercontent.com/cyvb/GOG-Web-Helper/main/gog-web-helper.meta.js
// @downloadURL    https://raw.githubusercontent.com/cyvb/GOG-Web-Helper/main/gog-web-helper.user.js
// @resource       CUSTOM_CSS https://raw.githubusercontent.com/cyvb/GOG-Web-Helper/main/custom-css.css
// @match          https://*.gog.com/*game/*
// @require        https://code.jquery.com/jquery-3.6.1.slim.min.js
// @require        https://momentjs.com/downloads/moment.min.js
// @grant          GM_log
// @grant          GM_xmlhttpRequest
// @grant          GM_getResourceText
// @grant          GM_addStyle
// @connect        api.gog.com
// @connect        content-system.gog.com
// @license        MIT; https://opensource.org/licenses/MIT
// @copyright      2021
// @run-at         document-end
// ==/UserScript==


class DataHolder {
    constructor(product_uid) {
        this._uid = product_uid;
        this._packages = [];
        this._available = true;
        this._update = null;
    }

    async init() {
        let response_json = JSON.parse( await syncXmlHttpRequest(`https://api.gog.com/v2/games/${this._uid}`) );

        if (!response_json._embedded.product.isAvailableForSale) {
            this.available = false;
        }

        if (response_json._links.includesGames) {
            let regex_uid = /games\/(\d+)\?*/;

            for (let pkg_item of response_json._links.includesGames) {
                let pkg_uid = regex_uid.exec(pkg_item.href)[1];
                let pkg_resp_json = JSON.parse( await syncXmlHttpRequest(`https://api.gog.com/v2/games/${pkg_uid}`) );

                this._packages.push( {uid : pkg_uid, title : pkg_resp_json._embedded.product.title, type : pkg_resp_json._embedded.productType} );
            }
        }

        this._update = await this.getProductLastestVersionAndTime(this._uid);
        let t_uid = this._uid;
        if (this._update.time === 'N/A') {
            for (let pkg_item of this._packages) {
                if (pkg_item.type === 'GAME') {
                    t_uid = pkg_item.uid;
                    break;
                }
            }
        }
        if (t_uid != this._uid) {
            this._update = await this.getProductLastestVersionAndTime(t_uid);
        }
    }

    async getProductLastestVersionAndTime(uid) {
        let response_json = JSON.parse( await syncXmlHttpRequest(`https://content-system.gog.com/products/${uid}/os/windows/builds?generation=2`) );
        return {
            version : ( response_json.items[0] === undefined ? 'N/A' : response_json.items[0].version_name ),
            time : ( response_json.items[0] === undefined ? 'N/A' : moment(response_json.items[0].date_published).format('LL') )
        };
    }

    get uid() {
        return this._uid;
    }

    get packages() {
        return this._packages;
    }

    get available() {
        return this._available;
    }

    get update() {
        return this._update;
    }
}

function getCurrencySymbol(currency) {
    switch (currency) {
        case 'CNY':
            return('CN¥');
        case 'EUR':
            return('€');
        case 'GBP':
            return('£');
        case 'RUB':
            return('₽');
        case 'USD':
            return('US$');

        default:
            return(`${currency}?`);
    }
}

function syncXmlHttpRequest(target_url) {
    return new Promise( (resolve, reject) => {
        GM_xmlhttpRequest( {
            method: 'GET',
            url: target_url,
            onload: function(resp) {
                resolve(resp.response);
            },
            onerror: function(error) {
                reject(error);
            }
        } );
    } );
}

function _addPrices() {
    // GOG seperators
    let detailsSeparators = $('.details__separator');
    // Add prices table
    // Table header
    $('<div id=\'Prices_Table_Block\'></div>').insertAfter(detailsSeparators[0]);
    $('#Prices_Table_Block').append( $(`
        <div class=\'table__row details__rating details__row details__row\'>
            <div class=\'details__category table__row-label\'>Regions</div>
            <div class=\'details__content table__row-content details__right-align\'>Prices</div>
        </div>
        <div class=\'block-scroll\' id=\'Prices_Table\'>
    `) );
    $('<hr class=\'details__separator\' />').insertAfter('#Prices_Table_Block');

    // If product is not available now in store
    if (!c_product_ptr.available) {
        $('#Prices_Table').append('<div class=\'unavailable-product\'><span data-content=\'Product is currently unavailable\'>Product is currently unavailable</span></div>');
        $('#Prices_Table').css('padding-right', 0);
        return 2;
    }

    for (let region of regions_list) {

        // Insert rows to the table
        $('#Prices_Table').append( $(`
            <div class=\'table__row details__rating details__row details__row\'>
                <div class=\'details__category table__row-label\'>${region}</div>
                <div class=\'details__content table__row-content details__right-align\' id=\'${region}_Region_Prices\'></div>
            </div>
        `) );

        // Get prices
        GM_xmlhttpRequest( {
            method: 'GET',
            url: `https://api.gog.com/products/${c_product_ptr.uid}/prices?countryCode=${region}`,
            onload: function(resp) {
                //if (resp.status != 200 && resp.status != 304) {
                //    return 1;
                //}

                let response_json = JSON.parse(resp.response);
                let prices = response_json._embedded.prices;

                let regex_price = /\d+/;
                for (let price_item of prices) {
                    // The 'c' stands for 'current'
                    let c_currency = price_item.currency.code;
                    let c_base_price = Number(regex_price.exec(price_item.basePrice)) / 100;
                    let c_current_price = Number(regex_price.exec(price_item.finalPrice)) / 100;
                    let c_discount_percent = parseInt( (c_current_price-c_base_price)/c_base_price*100 );

                    let dhp_class = (c_discount_percent != 0) ? 'class=\'discount-hover-placeholder\'' : '';
                    $(`#${region}_Region_Prices`).append(`<span ${dhp_class} id=\'${region}_${c_currency}_Block\'></span>`);

                    // Append discount label if it exists
                    if(c_discount_percent != 0) {
                        $(`#${region}_${c_currency}_Block`).append(`<span class=\'discount-label\'><span>${c_discount_percent}%</span></span>`);
                    }

                    // Detect price discount for preparations of class names
                    let price_tag_class = (c_discount_percent != 0) ? 'price-discount' : 'price-normal';
                    // Split price text into currency symbol, integer part and fractional part.
                    let c_price_split = c_current_price.toString().split('.');
                    $(`#${region}_${c_currency}_Block`).append(`<span class=\'${price_tag_class}\' id=\'${region}_${c_currency}\'></span>`);
                    // Append currency symbol.
                    $(`#${region}_${c_currency}`).append(`<span class=\'currency-symbol\'>${getCurrencySymbol(c_currency)}</span>`);
                    // Append integer part and fractional part.
                    for (let [part_index,part] of c_price_split.entries()) {
                        $(`#${region}_${c_currency}`).append( (part_index === 0) ? `<span class=\'price-int\'>${part}</>` : `<span class=\'price-frac\'>.${part}</>` );
                    }
                }

                $(`#${region}_Region_Prices`).append(`<span class=\'region-flag\'><img src=\'https://raw.githubusercontent.com/fonttools/region-flags/gh-pages/svg/${region}.svg\' class=\'region-flag-img\' /></span>`);
            }
        } );

    }
}

async function _addVersions() {
    async function _addVersionLabel(pkg_item) {
        let c_version_info = await c_product_ptr.getProductLastestVersionAndTime(pkg_item.uid);
        $('#Versions_Table').append(`
            <div class=\'table__row details__rating details__row details__row\'>
                <div class=\'details__category table__row-label\'>${pkg_item.title}</div>
                <div class=\'details__content table__row-content details__right-align\'>${c_version_info.version}</div>
            </div>
        `);
    }


    // Add last update time in 'Games details' section
    let release_date_div = $('.details__row')[2]
    $('<div class=\'table__row details__row details-update\'><div class=\'details__category table__row-label\'>Last update:</div></div>').insertAfter(release_date_div);
    $('.details-update').append(`<div class=\'details__content table__row-content\'><span>${c_product_ptr.update.time}</span></div>`);

    // The seperate section shows product's versions
    let detailsSeparators = $('.details__separator');
    $('<div id=\'Versions_Table_Block\'></div>').insertAfter(detailsSeparators[1]);

    $('#Versions_Table_Block').append( $(`
        <div class=\'table__row details__rating details__row details__row--first\'>
            <div class=\'details__category table__row-label\'>Title</div>
            <div class=\'details__content table__row-content details__right-align\'>Version</div>
        </div>
        <div id=\'Versions_Table\'>
    `) );
    $('<hr class=\'details__separator\' />').insertAfter('#Versions_Table_Block');

    for (let pkg_item of c_product_ptr._packages) {
        if (pkg_item.type === 'GAME') {
            await _addVersionLabel(pkg_item);
        }
    }
    for (let pkg_item of c_product_ptr._packages) {
        if (pkg_item.type === 'DLC') {
            await _addVersionLabel(pkg_item);
        }
    }
}


// Global variables
// Regions in ISO 3166-1 alpha-2 codes
var regions_list = ['AR', 'CN', 'FR', 'GB', 'HK', 'JP', 'RU', 'UA', 'US'];
// Current game on page info class
var c_product_ptr = null;

// Preparations
// Add custom css styles
GM_addStyle(GM_getResourceText('CUSTOM_CSS'));

// Test CSS
// For devs ONLY. Comment the following out when releasing!
//let _css = `
//    <style>
//
//    </style>
//`;
//$('html > head').append(_css);
// Test CSS -END-


// Main
(async function() {
    'use strict';

    c_product_ptr = new DataHolder( $('.layout')[0].getAttribute('card-product') ); // product uid
    await c_product_ptr.init();

    _addPrices();
    await _addVersions();
})();