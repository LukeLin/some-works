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
                    this.state = tuples[i][2];
                    this.list[i ^ 1] = this.list[2] = undefined;
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
                    if(list[i].apply(this.memory[0], this.memory[1]) === false) {
                        this.memory = false;
                        break;
                    }
                }
                this.firing = false;

                list = [];
            }
        };
    }

    return {
        create: function(fn){
            return new Deferred(fn);
        },
        // TODO
        when: when
    };
});



// test:
require([
        //'callbacks',
        'deferred',
        //'jquery'
    ], function (/*Callbacks, */Deferred/*, $*/) {
        var start, end;
        start = (new Date()).getTime();
        var a = Deferred.create();
        a.done(function () {
            console.log('done!');
            console.log(this);
        })
                .fail(function () {
                    console.log('failed');
                })
                .always(function () {
                    console.log('always');
                })
                .then(function () {
                    console.log(arguments);
                    console.log('then done');
                }, function () {
                    console.log('then failed');
                })
                .then(function () {
                    var def = Deferred.create();
                    def.then(function () {
                        console.log('a returned def done');
                    }, function () {
                        console.log('a returned def failed');
                    });

                    setTimeout(function () {
                        def.resolve();
                    }, 511);
                    return def;
                }, function () {
                    var def = Deferred.create();
                    def.then(function () {
                        console.log('a returned def done');
                    }, function () {
                        console.log('a returned def failed');
                    });

                    setTimeout(function () {
                        def.reject();
                    }, 511);
                    return def;
                });
        end = (new Date()).getTime();
        console.log(end - start + 'ms');

        var b = Deferred.create();
        b.done(function () {
            console.log('b done');
        })
                .fail(function () {
                    console.log('b failed');
                })
                .then(function () {
                    console.log('b then done');
                }, function () {
                    console.log('b then failed');
                })
                .then(function () {
                    var def = new Deferred();
                    def.then(function () {
                        console.log('b returned def done');
                    }, function () {
                        console.log('b returned def failed');
                    });

                    setTimeout(function () {
                        def.resolve();
                    }, 511);
                    return def;
                }, function () {
                    var def = Deferred.create();
                    def.then(function () {
                        console.log('b returned def done');
                    }, function () {
                        console.log('b returned def failed');
                    });

                    setTimeout(function () {
                        def.reject();
                    }, 511);
                    return def;
                });

        setTimeout(function () {
            a.resolve({
                data: 123
            });
            console.log(a);
        });

        setTimeout(function () {
            b.reject();
            console.log(b);
        });
    });
