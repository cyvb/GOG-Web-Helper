// ==UserScript==
// @name           GOG Web Helper
// @version        0.1.1
// @namespace      cyvb
// @author         cyvb
// @description    Useful GOG tools on product page.
// @updateURL      https://github.com/cyvb/GOG-Web-Helper/raw/main/gog-web-helper.user.js
// @include        http*://*.gog.com/game/*
// @require        https://code.jquery.com/jquery-3.6.0.slim.min.js
// @grant          GM_log
// @grant          GM_xmlhttpRequest
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

// ISO 3166-1 alpha-2 codes
var regions_list = ['AR', 'CN', 'FR', 'GB', 'HK', 'JP', 'UA', 'US'];

// Add custom CSS
let c_css = $(`
    <style>
        .details__right-align {
            text-align: right;
        }

        .price-tag {
            position: relative;
            margin-left: 0.5em;
            min-width: 3.7em;
            height: 100%;
            text-align: center;
            vertical-align: middle;
            background: #cacaca;
            border: 1px solid #cacaca;
            border-radius: 0.2em;
            padding: 0.2em 0.1em 0.1em 0.2em;
        }

        .price-tag::before, .price-tag::after {
            content: \'\';
            border-style: solid;
            position: absolute;
            border-radius: 0.2em;
            box-sizing: content-box;
            transition: all 0.3s;
        }

        .price-normal::before, .price-normal::after {
            border-color: #865c91;
        }

        .price-discount::before, .price-discount::after {
            border-color: #4c6b22;
        }

        .price-tag::before {
            width: 0;
            height: 100%;
            border-width: 1px 0 1px 0;
            top: -1px;
            left: 0;
            transition-delay: 0.05s;
        }

        .price-tag::after {
            width: 100%;
            height: 0;
            border-width: 0 1px 0 1px;
            top: 0;
            left: -1px;
        }

        .price-normal:hover {
            background: #b57cc1;;
            color: #eeeeee;
        }

        .price-discount:hover {
            background: #a4d015;
            color: #4c6b22;
        }

        .price-tag:hover::before {
            width: 100%;
        }

        .price-tag:hover::after {
            height: 100%;
        }

        .discount-hover-placeholder {
            height: 100%;
        }

        .discount-hover-placeholder:hover .discount-label {
            transition: margin-right 1s;
            transition-timing-function: ease-out;
            margin-right: -0.7em;
        }

        .block-scroll {
            max-height: 12em;
            overflow-y: scroll;
            overflow-x: hidden;
            padding-right: 10px;
        }

        .block-scroll::-webkit-scrollbar {
            width: 6px;
        }

        .block-scroll::-webkit-scrollbar-thumb {
            background: #b57cc1;
            border-radius: 3px;
        }

        #Prices_Table span {
            display: inline-block;
        }

        .region-flag {
            min-width: 3.5em;
        }

        .region-flag-img {
            height: 1.5em;
            vertical-align: middle;
            -webkit-mask-image: -webkit-linear-gradient(left, #ffffff00 5%, #ffffff7f 70%, #ffffffff 100%);
        }

        .currency-symbol {
            margin-right: 0.25em;
            font-style: italic;
        }

        .price-int {
            font-weight: bold;
        }

        .price-frac {
            font-size: 0.7em;
        }

        .discount-label {
            margin-right: -4.2em;
            margin-left: 0.5em;
            padding-right: 0.2em;
            width: 3.7em;
            height: 100%;
            text-align: center;
            vertical-align: middle;
            border-radius: 0.2em;
            background: #4c6b22;
            color: #a4d015;
            will-change: margin-right;
            transition: margin-right 0.5s;
        }

        .discount-label span {
            vertical-align: sub;
            font-size: 0.9em;
        }

        @keyframes slideio {
            0% { margin-right: -4.2em; }
            10% { margin-right: -4.2em; }
            90% { margin-right: -0.7em; }
            100% { margin-right: -0.7em; }
        }
    </style>
`);
$('html > head').append(c_css);

/*
background-image: url(https://raw.githubusercontent.com/fonttools/region-flags/gh-pages/svg/AC.svg);
background-size: contain;
background-repeat: no-repeat;
background-position: right;
*/

// Main
(function() {
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


    regions_list.forEach( function(region) {

        // Table rows
        $('#Prices_Table').append( $(`
            <div class=\'table__row details__rating details__row details__row--first\'>
                <div class=\'details__category table__row-label\'>${region}</div>
                <div class=\'details__content table__row-content details__right-align\' id=\'${region}_Region_Prices\'>
                </div>
            </div>
        `) );

        GM_xmlhttpRequest( {
            method: 'GET',
            url: `https://api.gog.com/products/${product_uid}/prices?countryCode=${region}`,
            onload: function(resp) {
                if (resp.status != 200 && resp.status != 304) {
                    return;
                }

                let contentJson = JSON.parse(resp.response);
                let prices = contentJson._embedded.prices;

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
                    let price_tag_class = (c_discount_percent != 0) ? 'price-tag price-discount' : 'price-tag price-normal';
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