/**
 * 与nodejs的querystring模块对查询字符串处理一致。
 * 只提供了和nodejs的qs.parse()和qs.stringify()这两个方法
 */

/**
 * 类型转换成字符串
 * @param {*} a
 * @returns {String}
 */
function stringifyPrimitive(a) {
    switch (typeof a) {
        case 'string':
            return a;
        case 'boolean':
            return a ? 'true' : 'false';
        case 'number':
            return isFinite(a) ? a + '' : '';
        default:
            return '';
    }
}

/**
 * 将对象序列化(会被编码，不会深度转换)
 *
 * @param {Object} obj
 * @param {String} sep 每组key/value的连接符"&"
 * @param {String} eq key和value的连接符，默认"="
 * @returns {string}
 * @example
 *   var a = {a: 1, b: [1, 2, 3], c: {a: 1, b: 2}};
 *   stringify(a);
 *   output: "a=1&b=1&b=2&b=3&c="
 *
 */
var stringify = Object.keys && Array.map && Array.isArray ?
    function (obj, sep, eq) {
        sep = sep || '&';
        eq = eq || '=';

        if (obj === null) obj = undefined;

        if (typeof obj === 'object') {
            return Object.keys(obj).map(function (k) {
                var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;

                if (Array.isArray(obj[k])) {
                    return obj[k].map(function (v) {
                        return ks + encodeURIComponent(stringifyPrimitive(v));
                    }).join(sep);
                } else {
                    return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
                }
            }).join(sep);
        }

        return '';
    } :
    function (obj, sep, eq) {
        sep = sep || '&';
        eq = eq || '=';
        if (obj === null) obj = undefined;

        var str = '';
        if (typeof obj === 'object') {
            var ks, j, v, k, i;

            for (i in obj) {
                if (!obj.hasOwnProperty(i)) continue;

                ks = encodeURIComponent(i) + eq;
                k = obj[i];

                if (Object.prototype.toString.call(obj[i]) === '[object Array]') {
                    for (j = 0; j < k.length; j++) {
                        v = k[j];
                        str += ks + encodeURIComponent(stringifyPrimitive(v)) + sep;
                    }
                } else {
                    str += ks + encodeURIComponent(stringifyPrimitive(k)) + sep;
                }
            }

            str = str.slice(0, str.length - 1);
        }

        return str;
    };

/**
 * 将字符串反序列化（会被解码）
 *
 * @param {String} qs
 * @param {String} sep 每组key/value的连接符"&"
 * @param {String} eq key和value的连接符，默认"="
 * @returns {Object}
 * @example
 *   var a = "a=1&b=1&b=2&b=3&c=";
 *   parse(a);
 *   output: {a: 1, b: [1, 2, 3], c: ""}
 */
var parse = function (qs, sep, eq) {
    sep = sep || '&';
    eq = eq || '=';
    var obj = {};

    if (typeof qs !== 'string' || !qs.length)  return obj;

    var regexp = /\+/g;
    qs = qs.split(sep);
    var part, lStr, rStr, index;

    for (var i = 0, len = qs.length; i < len; i++) {
        part = qs[i].replace(regexp, '%20');
        index = part.indexOf(eq);

        if (index >= 0) {
            lStr = part.slice(0, index);
            rStr = part.slice(index + 1);
        } else {
            lStr = part;
            rStr = '';
        }

        lStr = decodeURIComponent(lStr);
        rStr = decodeURIComponent(rStr);

        if (!obj.hasOwnProperty(lStr)) {
            obj[lStr] = rStr;
        } else if (Object.prototype.toString.call(obj[lStr]) === '[object Array]') {
            obj[lStr].push(rStr);
        } else {
            obj[lStr] = [obj[lStr], rStr];
        }
    }

    return obj;
};

var QueryString = {
    parse: parse,
    stringify: stringify
};

module.exports = QueryString;
