// ==UserScript==
// @name           GOG Web Helper
// @version        0.1.3
// @namespace      cyvb
// @author         cyvb
// @description    Useful GOG tools on product page.
// @updateURL      https://github.com/cyvb/GOG-Web-Helper/raw/main/gog-web-helper.meta.js
// @downloadURL    https://github.com/cyvb/GOG-Web-Helper/raw/main/gog-web-helper.user.js
// @resource       CUSTOM_CSS https://raw.githubusercontent.com/cyvb/GOG-Web-Helper/main/custom-css.css
// @include        https://*.gog.com/game/*
// @require        https://code.jquery.com/jquery-3.6.0.slim.min.js
// @grant          GM_log
// @grant          GM_xmlhttpRequest
// @grant          GM_getResourceText
// @grant          GM_addStyle
// @connect        api.gog.com
// @license        MIT; https://opensource.org/licenses/MIT
// @copyright      2021
// @run-at         document-end
// ==/UserScript==


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

// Preparations
// ISO 3166-1 alpha-2 codes
var regions_list = ['AR', 'CN', 'FR', 'GB', 'HK', 'JP', 'RU', 'UA', 'US'];
// Add custom css styles
GM_addStyle(GM_getResourceText('CUSTOM_CSS'));

// Test CSS
// For devs ONLY. Comment these out when releasing!
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

    let detailsSeparators = $('.details__separator');

    // Product ID
    let product_uid = $('.layout')[0].getAttribute('card-product');

    // Add prices table
    // Table header
    $('<div id=\'Prices_Table_Block\'></div>').insertAfter(detailsSeparators[0]);
    $('#Prices_Table_Block').append( $(`
        <div class=\'table__row details__rating details__row details__row--first\'>
            <div class=\'details__category table__row-label\'>Prices</div>
            <div class=\'details__content table__row-content details__right-align\'>
                Currencies
            </div>
        </div>
    `) );
    $('#Prices_Table_Block').append($('<div class=\'block-scroll\' id=\'Prices_Table\'>'));
    $('<hr class=\'details__separator\' />').insertAfter('#Prices_Table_Block');

    // If product is not available now in store
    let response_json = await syncXmlHttpRequest(`https://api.gog.com/v2/games/${product_uid}`);
    if (!JSON.parse(response_json)._embedded.product.isAvailableForSale) {
        $('#Prices_Table').append('<div class=\'unavailable-product\'><span data-content=\'Product is currently unavailable\'>Product is currently unavailable</span></div>');
        $('#Prices_Table').css('padding-right', 0);
        return 2;
    }

    regions_list.forEach( function(region) {

        // Table rows
        $('#Prices_Table').append( $(`
            <div class=\'table__row details__rating details__row details__row--first\'>
                <div class=\'details__category table__row-label\'>${region}</div>
                <div class=\'details__content table__row-content details__right-align\' id=\'${region}_Region_Prices\'>
                </div>
            </div>
        `) );

        // Get prices
        GM_xmlhttpRequest( {
            method: 'GET',
            url: `https://api.gog.com/products/${product_uid}/prices?countryCode=${region}`,
            onload: function(resp) {
                //if (resp.status != 200 && resp.status != 304) {
                //    return 1;
                //}

                let content_json = JSON.parse(resp.response);
                let prices = content_json._embedded.prices;

                let regex_price = /\d+/;
                prices.forEach( function(price_item) {
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
                    c_price_split.forEach( function(part, part_index) {
                        $(`#${region}_${c_currency}`).append( (part_index == 0) ? `<span class=\'price-int\'>${part}</>` : `<span class=\'price-frac\'>.${part}</>` );
                    } );

                } );

                $(`#${region}_Region_Prices`).append(`<span class=\'region-flag\'><img src=\'https://raw.githubusercontent.com/fonttools/region-flags/gh-pages/svg/${region}.svg\' class=\'region-flag-img\' /></span>`);
            }
        } );

    });
})();