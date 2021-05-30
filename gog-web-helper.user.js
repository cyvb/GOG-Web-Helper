// ==UserScript==
// @name           GOG Web Helper
// @version        0.1.0
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

// ISO 3166-1 alpha-2 codes
var regions_list = ['AR', 'CN', 'FR', 'GB', 'HK', 'JP', 'UA', 'US'];

// Add custom CSS
let c_css = $(`
    <style>
        .details__right-align {
            text-align: right;
        }

        .price-tag {
            margin-left: 0.5em;
        }

        .block-scroll {
            max-height: 10em;
            overflow-y: scroll;
            overflow-x: hidden;
            padding-right: 10px;
        }

        .block-scroll::-webkit-scrollbar {
            width: 6px;
        }

        .block-scroll::-webkit-scrollbar-thumb {
            background: #865c91;
            border-radius: 3px;
        }

        #Prices_Table > span {
            display: inline-block;
        }

        .region-flag {
            max-height: 1.5em;
            vertical-align: middle;
            -webkit-mask-image: -webkit-linear-gradient(left, #ffffff00 10%, #ffffffff);
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
    GM_log(detailsSeparators);

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
                    let c_region = 'UA';
                    let c_currency = price_item.currency.code;
                    let c_base_price = Number(regex_price.exec(price_item.basePrice)) / 100;
                    let c_current_price = Number(regex_price.exec(price_item.finalPrice)) / 100;
                    let c_discount_percent = parseInt( (c_current_price-c_base_price)/c_base_price*100 );
                    GM_log(c_discount_percent);

                    $(`#${region}_Region_Prices`).append(`<span class=\'price-tag\'>${c_currency} ${c_current_price} ${c_discount_percent}%</span>`)
                } );
                
                $(`#${region}_Region_Prices`).append(`<span><img src=\'https://raw.githubusercontent.com/fonttools/region-flags/gh-pages/svg/${region}.svg\' class=\'region-flag\' /></span>`);
            }
        } );

    });
})();