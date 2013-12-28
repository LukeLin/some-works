define(function(){
    var tuples = [
        ['resolve', 'done', 'resolved'],
        ['reject', 'fail', 'rejected'],
        ['notify', 'progress']
    ];

    var Promise = function(){
        this.state = 'pending';
        this.list = [[], [], []];
        var me = this;

        for(var i = 0, len = this.list.length; i < len; i++) {
            (function(i){
                me.list[i].unshift(function(){
                    me.state = tuples[i][2];
                    me.list[i ^ 1] = me.list[2] = undefined;
//                    this[i ^ 1] = this[2] = undefined;
                });
            }(i));
        }
    };

    Promise.prototype = {
        state: function(){
            return this.state;
        },
        always: function(cb){
            this.done(cb).fail(cb);
            return this;
        },
        then: function(/* fnDone, dnFail, fnProgress */){
            var me = this;
            var fns = arguments;
            var newDefer =  new Deferred(function(newDefer){
                var tuple, action, fn;
                for(var i = 0; i < tuples.length; i++) {
                    tuple = tuples[i];
                    action = tuple[0];
                    fn = fns[i];

                    me[tuple[1]](function(fn, action){
                        return function(){
                            var returned = fn && fn.apply(this, arguments);

                            if(returned && typeof returned.promise === 'function') {
                                returned.promise()
                                    .done(newDefer.resolve)
                                    .fail(newDefer.reject)
                                    .progress(newDefer.notify);
                            } else {
                                newDefer[action + 'With'](
                                    this === me ? newDefer.promise() : this,
                                    fn ? [returned] : arguments
                                );
                            }
                        };
                    }(fn, action));
                }
                fns = null;
            });

            return newDefer.promise();
        },
        promise: function(obj){
            if(obj != null) {
                var prop;
                if(obj.constructor && obj.constructor !== Object) {
                    for(prop in this) {
                        if(typeof this[prop] === 'function') {
                            obj.constructor.prototype[prop] = this[prop];
                        } else {
                            obj[prop] = this[prop];
                        }
                    }
                } else {
                    for(prop in this) {
                        obj[prop] = this[prop];
                    }
                }

                return obj;
            } else {
                return this;
            }
        }
    };

    var Deferred = function(func){
        this.memory = true;
        new Promise().promise(this);

        if(func) {
            func.call(this, this);
        }
    };

    var tuple;
    for(var i = 0, len = tuples.length; i < len; i++) {
        tuple = tuples[i];
        Promise.prototype[tuple[1]] = registeryBuilder(i);
        Deferred.prototype[tuple[0]] = fireBuilder(tuple[0]);
        Deferred.prototype[tuple[0] + 'With'] = fireWithBuilder(i);
    }

    function registeryBuilder(index){
        return function(cb){
            var list = this.list[index];
            if(this.state !== 'pending') {
                cb.apply(list.data[0], list.data[1]);
            } else {
                list.push(cb);
            }

            return this;
        };
    }

    function fireBuilder(state){
        return function(){
            return this[state + 'With'](this, arguments);
        };
    }

    function fireWithBuilder(index){
        return function(context, args){
            var list = this.list[index];
            if(list && !this.fired) {
                args = args || [];
                this.memory = this.memory && [context, args.slice ? args.slice() : args];

                this.fired = true;
                this.firing = true;
                for(var i = 0, len = list.length; i < len; i++) {
                    if(list[i].apply(context, args) === false) {
                        this.memory = false;
                        break;
                    }
                }
                this.firing = false;

                list = [];
            }

            return this;
        };
    }

    function forEach(o, cb){
        var oToString = Object.prototype.toString;
        var i, len;
        if(oToString.call(o) === '[object Array]') {
            for(i = 0, len = o.length; i < len; i++) {
                if(cb.call(o[i], o[i], i) === false) break;
            }
        } else if(oToString.call(o) === '[object Object]') {
            for(i in o){
                if(!o.hasOwnProperty(i)) continue;

                if(cb.call(o[i], o[i], i) === false) break;
            }
        }
    }

    return {
        create: function(fn){
            return new Deferred(fn);
        },
        // TODO
        when: function(subordinate /* , ... subordinateN */){
            var i = 0;
            var resolveValues = [].slice.call(arguments);
            var length = resolveValues.length;
            var remaining = length !== 1 || (subordinate && typeof subordinate.promise === 'function') ? length : 0;
            var deferred = remaining === 1 ? subordinate : new Deferred();
            var updateFunc = function(i, contexts, values){
                return function(value){
                    contexts[i] = this;
                    values[i] = arguments.length > 1 ?[].call(arguments) : value;
                    if(value === progressValues){
                        deferred.notifyWith(contexts, values);
                    } else if(!(--remaining)) {
                        deferred.resolveWith(contexts, values);
                    }
                };
            };
            var progressValues, progressContexts, resolveContexts;

            if(length > 1) {
                progressValues = new Array(length);
                progressContexts = new Array(length);
                resolveContexts = new Array(length);
                for(; i < length; i++) {
                    if(resolveValues[i] && typeof resolveValues[i].promise === 'function') {
                        resolveValues[i].promise()
                            .done(updateFunc(i, resolveContexts, resolveValues))
                            .fail(deferred.reject)
                            .progress(updateFunc(i, progressContexts, progressValues));
                    } else {
                        --remaining;
                    }
                }
            }

            if(!remaining) {
                deferred.resolveWith(resolveContexts, resolveValues);
            }

            return deferred.promise();
        },
        all: function(promises){
            var deferred = new Deferred();
            var counter = 0;
            var isArray = Object.prototype.toString.call(promises)=== ['object Array'];
            var results =  isArray ? [] : {};
            if(!isArray) {
                promises = [].slice.call(arguments);
            }

            forEach(promises, function(promise, key){
                counter++;
                if(typeof promise.promise !== 'function') {
                    var def = new Deferred();
                    promise = def.promise(promise);
                    setTimeout(function(){
                        def.resolve(promise);
                    });
                }

                promise.then(function(value){
                    if(results.hasOwnProperty(key)) return;
                    results[key] = value;
                    if(!(--counter)) deferred.resolve(results);
                }, function(){
                    if(results.hasOwnProperty(key)) return;
                    deferred.reject();
                });
            });

            if(counter === 0) deferred.resolve(results);

            return deferred.promise();
        },
        any: function(promises){
            var deferred = new Deferred();
            var done;
            var isArray = Object.prototype.toString.call(promises)=== ['object Array'];
            if(!isArray) {
                promises = [].slice.call(arguments);
            }

            forEach(promises, function(promise, key){
                if(typeof promise.promise !== 'function') {
                    var def = new Deferred();
                    promise = def.promise(promise);
                    setTimeout(function(){
                        def.resolve(promise);
                    });
                }

                promise.then(function(value){
                    if(done) return;
                    done = true;
                    deferred.resolve();
                }, function(){
                    if(done) return;
                    deferred.reject();
                });
            });

            return deferred.promise();
        }
    };
});
