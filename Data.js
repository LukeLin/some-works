define(function(){

    function isEmptyObject(obj){
        var prop;

        for(prop in obj) {
            return false;
        }

        return true;
    }

    var Data = function(){
        this.expando = ('myData' + Math.random() + (new Date()).getTime()).replace(/\D/g, '');
    };

    Data.guid = 1;
    Data.cache = {};

    Data.prototype = {
        constructor: Data,
        set: function(ele, key, value){
            if(!ele || typeof key !== 'string') return;

            var internalKey = this.expando;
            var isNode = ele.nodeType;
            var cache = isNode ? Data.cache : ele;
            var id = isNode ? ele[this.expando] : ele[this.expando] && internalKey;

            if((!id || !cache[id] || !cache[id].data) && value === undefined) {
                return;
            }

            if(!id) {
                if(isNode) {
                    id = ele[this.expando] = Data.guid++;
                } else {
                    id = this.expando;
                }
            }

            cache[id] = cache[id] || {};

            var thisCache = cache[id];

            thisCache.data = thisCache.data || {};

            if(value !== undefined) {
                thisCache.data[key] = value;
            } else {
                value = thisCache.data[key];
            }

            return value;
        },
        get: function(ele, key){
            return this.set(ele, key);
        },
        clear: function(elem, key){
            if(!elem) {
                return;
            }

            var isNode = elem.nodeType;
            var cache = isNode ? Data.cache : elem;
            var id = isNode ? elem[this.expando] :
                this.expando;

            if(!cache[id]) {
                return;
            }

            if(key === undefined) {
                cache[id] = {};
            } else {
                var thisCache = cache[id].data;

                if(key in thisCache) {
                    key = [key];
                } else {
                    key = key.replace(/-([\da-z])/gi, function(all, letter){
                        return letter.toUpperCase();
                    });

                    if(key in thisCache) {
                        key = [key];
                    } else {
                        key = key.split(' ');
                    }
                }

                for(var i = 0, len = key.length; i < len; i++) {
                    delete thisCache[key[i]];
                }

                if(!isEmptyObject(thisCache)) {
                    return;
                }
            }

            delete cache[id].data;

            if(!isEmptyObject(cache[id])) {
                return;
            }

            if(isNode) {
                try {
                    delete elem[this.expando];
                } catch(ex) {
                    if(typeof elem.removeAttribute !== 'undefined') {
                        elem.removeAttribute(this.expando);
                    } else {
                        elem[this.expando] = null;
                    }
                }
            } else {
                try {
                    delete cache[id];
                } catch(ex) {
                    cache[id] = null;
                }
            }

        }
    };
    
    return Data;
});
