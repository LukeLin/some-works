var r_DATE_FORMATTER = /(y+|M+|d+|h+|m+|s+)/g;

    /**
     *
     * @param {String} name Date实例的方法名，去除“get”。如果要取得"getFullYear()"则传"FullYear"
     * @param {Number} size 返回的字符串长度，如果不够，前面加“0”
     * @param {Number} offset 偏差值。 如果== -12说明是12小时制
     * @param {Boolean} trim 是否根据size截取字符串
     * @returns {Function}
     */
    function dateGetter(name, size, offset, trim) {
        offset = offset || 0;
        return function (date) {
            var value = date['get' + name]();
            if (offset > 0 || value > -offset) {
                value += offset;
            }
            if (value === 0 && offset == -12) {
                value = 12;
            }
            return padNumber(value, size, trim);
        };
    }

    // 处理正负号，补零或者截取
    function padNumber(num, digits, trim) {
        var neg = '';
        if (num < 0) {
            neg = '-';
            num = -num;
        }
        num = '' + num;
        while (num.length < digits) {
            num = '0' + num;
        }
        if (trim) {
            num = num.slice(num.length - digits);
        }
        return neg + num;
    }

    var DATE_FORMATTERS = {
        'yyyy': dateGetter('FullYear', 4),
        'yy': dateGetter('FullYear', 2, 0, true),
        'M': dateGetter('Month', 1, 1),
        'MM': dateGetter('Month', 2, 1),
        'd': dateGetter('Date', 1),
        'dd': dateGetter('Date', 2),
        'h': dateGetter('Hours', 1),
        'hh': dateGetter('Hours', 2),
        'H': dateGetter('Hours', 1, -12),
        'HH': dateGetter('Hours', 2, -12),
        'm': dateGetter('Minutes', 1),
        'mm': dateGetter('Minutes', 2),
        's': dateGetter('Seconds', 1),
        'ss': dateGetter('Seconds', 2)
    };

    /**
     *
     * @param {DateString} time
     * @param {String} timePattern
     * 1.yy-M-d h:m
     * 2.yyyy/MM/dd hh:mm
     */
    function formatDate(time, timePattern) {
        if (!time) return '';

        time = new Date(time);

        timePattern = timePattern.replace(r_DATE_FORMATTER, function (_, format) {
            var fn = DATE_FORMATTERS[format];
            return fn ? fn(time) : format;
        });

        return timePattern;
    }
