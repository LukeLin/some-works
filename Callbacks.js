define(function(){

    var Callbacks = function(options){
        options = options || {};

        this.list = [];
        this.stack = !options.once && [];
        this.memory = null;

        var firing = false;
        var fired = false;
        var firingStart = 0;
        var firingLength = 0;
        var firingIndex = 0;

        this.add = function(cb){
            if(!this.list) {
                return this;
            }

            var me = this;
            var start = this.list.length;

            void function add(cb){
                if(typeof cb === 'function'){
                    if(!options.unique || !me.has(cb)) {
                        me.list.push(cb);
                    }
                } else if(Object.prototype.toString.call(cb) === '[object Array]') {
                    for(var i = 0, len = cb.length; i < len; i++) {
                        add(cb[i]);
                    }
                }
            }(cb);

            if(firing) {
                firingLength = this.list.length;
            } else if(this.memory) {
                firingStart = start;
                fire(this.memory);
            }

            return this;
        };

        this.fireWith = function(context, args){
            args = args || [];
            args = [context, args.slice ? args.slice() : args];

            if(this.list && (!fired || this.stack)) {
                if(firing) {
                    this.stack.push(args);
                } else {
                    fire(args);
                }
            }

            return this;
        };

        this.remove = function(cb){
            var i, len;
            if(this.list) {
                if(Object.prototype.toString.call(cb) === '[object Array]') {
                    for(i = 0, len = cb.length; i < len; i++) {
                        this.remove(cb[i]);
                    }
                } else {
                    len = this.list.length;

                    while(--len >= 0) {
                        if(this.list[len] === cb) {
                            this.list.splice(len, 1);
                        }

                        if(firing) {
                            if(len <= firingLength) {
                                firingLength--;
                            }
                            if(len <= firingIndex) {
                                firingIndex--;
                            }
                        }
                    }
                }
            }

            return this;
        };

        var self = this;
        function fire(data){
            self.memory = options.memory && data;
            fired = true;
            firingIndex = firingStart || 0;
            firingStart = 0;
            firingLength = self.list.length;

            firing = true;

            for(; self.list && firingIndex < firingLength; firingIndex++) {
                if(self.list[firingIndex].apply(data[0], data[1]) === false && options.stopOnFalse) {
                    self.memory = false;
                    break;
                }
            }

            firing = false;

            if(self.list) {
                if(self.stack){
                    if(self.stack.length) {
                        fire(self.stack.shift());
                    }
                } else if(self.memory) {
                    self.list = [];
                } else {
                    this.disable();
                }
            }
        }
    };

    Callbacks.prototype = {
        constrcutor: Callbacks,
        disable: function(){
            this.list = this.stack = this.memory = undefined;
            return this;
        },
        empty: function(){
            this.list = [];

            return this;
        },
        has: function(cb){
            for(var i = 0, len = this.list.length; i < len; i++) {
                if(cb === this.list[i]) {
                    return true;
                }
            }

            return false;
        },
        lock: function(){
            this.stack = undefined;
            if(!this.memory) {
                this.disable();
            }
            return this;
        },
        fire: function(){
            this.fireWith(this, arguments);
            return this;
        }
    };

    return Callbacks;
});
