var PubSub = function(){
            this.subscribers = {};
        };

        PubSub.prototype = {
            sub: function (name, fn) {
                if (!this.subscribers[name]) {
                    this.subscribers[name] = [];
                }

                if (typeof fn === 'function') {
                    this.subscribers[name].push(fn);
                }

                return this;
            },
            pub: function (name, context, args/* ...*/) {
                context = context || null;
                var subscriber = this.subscribers[name];
                args = args && Array.prototype.slice.call(args, 0) || [];

                if (!subscriber || Object.prototype.toString.call(subscriber) !== '[object Array]') {
                    __console.error('subscriber does not have the name:' + name);
                    return;
                }

                for (var i = 0, len = subscriber.length; i < len; i++) {
                    if (typeof subscriber[i] === 'function' && subscriber[i].apply(context, args) === false) {
                        break;
                    }
                }

                return this;
            },
            unsub: function (name, cb) {
                var subscriber = this.subscribers[name];

                if (!subscriber) {
                    __console.error('subscriber does not have the name:' + name);
                    return;
                }

                if (cb && typeof cb !== 'function') {
                    __console.error('the second argument should be a function');
                    return;
                }

                var len = subscriber.length;

                if (cb) {
                    while (--len >= 0) {
                        if (subscriber[len] === cb) {
                            subscriber.splice(len, 1);
                            return true;
                        }
                    }
                } else {
                    subscriber = [];
                    return true;
                }

                return false;
            },
            make: function (obj) {
                var prop;

                // 判断是否是实例对象
                if (obj.constructor && obj.constructor !== Object && obj instanceof obj.constructor) {
                    for (prop in this) {
                        if (typeof this[prop] === 'function') {
                            if (prop === 'make') continue;

                            obj.constructor.prototype[prop] = this[prop];
                            continue;
                        }

                        obj[prop] = this[prop];
                    }
                } else {
                    for (prop in this) {
                        if (prop === 'make') continue;
                        obj[prop] = this[prop];
                    }
                }
            }
        };
