/**
 * User: Luke
 * Date: 13-11-18
 */

/**
 * 验证器
 * @param {Object} formInstance
 * @constructor FormValidator
 */
var FormValidator = (function () {
    var r_space = /\s+/;

    // HTML转义
    var ENCODECHAR = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;'
    };

    // 验证策略
    var VALIDTYPES = {
        'nonEmpty': {
            validate: function (value) {
                return value !== '';
            },
            msg: '此项不能为空'
        },
        'email': {
            validate: function (value) {
                return (/^[\w\-]+@[\w\-]+(?:\.[\w\-]+)+$/.test(value));
            },
            msg: function(value){
                return (value ? '请输入正确格式的邮箱' : '请输入你的邮箱');
            }
        },
        'phone': {
            validate: function (value) {
                return (/^1[3|4|5|8]\d{9}$/.test(value));
            },
            msg: function(value){
                return (value ? '请输入正确格式的手机号码' : '请输入你的手机号码');
            }
        }
    };

    var formHooks = {
        'radio': 'checked',
        'checkbox': 'checked'
    };

    var formEventsHooks = {
        'text': formEventsGetter('blur'),
        'textarea': formEventsGetter('blur'),
        'checkbox': formEventsGetter('click'),
        'select': formEventsGetter('change'),
        'radio': formEventsGetter('click')
    };

    function formEventsGetter(type) {
        return function (el, context, item) {
            $(el).on(type, function(){
                context.errHandler = [];
                parseEachEleCfg(item);

                validating(item, context.errHandler);

                context.handleError();
            });
        };
    }

    /**
     * 验证器构造器
     * @param {Object} formInstance 用户自定义规则
     * @constructor
     */
    function Validator(formInstance) {
        var form = formInstance.form;
        if (!form) return;

        this.form = form;

        /*
         [{
         elem:elem,
         value: '',
         type: ''
         [optional] ,checker: {fn: func, description: ''}
         }, ..]
         */
        this.config = [];

        this.callbackLists = {
            success: [],
            failure: []
        };

        /*
         this.errHandler;
         */

        if (formInstance.types) $.extend(VALIDTYPES, formInstance.types);

        this.parsed = false;
        this.ajax = typeof formInstance.ajax === 'boolean' ?
            formInstance.ajax : true;

        if(formInstance.success) this.on('success', formInstance.success);
        if(formInstance.failure) this.on('failure', formInstance.failure);
        if(formInstance.beforeSend) this.beforeSend = formInstance.beforeSend;

        if (formInstance.evented) {
            this.parseConfig();
            this.parsed = true;
            this.addFormEvents(this.config);
        }

        this.submit();
    }

    // 防止XSS
    Validator.encodeValue = function (value) {
        for (var i in ENCODECHAR) {
            if (ENCODECHAR.hasOwnProperty(i))
                value = value.replace(new RegExp(i, 'g'), ENCODECHAR[i]);
        }

        return value;
    };

    Validator.prototype = {
        // TODO 为每个表单元素添加事件侦听
        addFormEvents: function (cfg) {
            var me = this;
            var elem, formType, item;
            for (var i = 0, len = cfg.length; i < len; i++) {
                item = cfg[i];
                elem = item.elem;
                formType = elem.type;

                formEventsHooks[formType](elem, me, item);
            }
        },
        hasErrors: function () {
            return !!this.errHandler.length;
        },
        on: function(type, cb){
            if(!this.callbackLists[type]) {
                throw new Error('no matched event type');
            }

            this.callbackLists[type] = this.callbackLists[type].concat(
                Object.prototype.toString.call(cb) === '[object Array]' ?
                    cb : [cb]
            );
        },
        emit: function(type, args){
            if(!this.callbackLists[type]) {
                throw new Error('no matched event type');
            }

            var list = this.callbackLists[type];

            if(type === 'failure' && args && args[0] && args[0].preventDefault) {
                args[0].preventDefault();
            }

            for(var i = 0, len = list.length; i < len; i++) {
                if(typeof list[i] === 'function' && list[i].apply(this.form, args) === false)
                    break;
            }
        },
        isDefaultPrevented: false,
        submit: function () {
            var me = this;

            if (!this.form) return;

            $(this.form).on('submit', function (e) {
                me.isDefaultPrevented = false;
                e._preventDefault = e.preventDefault;
                e.preventDefault = function(){
                    e._preventDefault();
                    me.isDefaultPrevented = true;
                };

                // 解析配置，parsed为false时，可再次解析
                if (!me.parsed) {
                    me.parseConfig();
                    me.parsed = true;
                }

                // 验证
                me.validate();

                // 验证有错误
                if (me.hasErrors()) {
                    me.handleError();

                    me.emit('failure', [e]);
                } else {
                    // ajax提交默认阻止表单提交
                    if (me.ajax) {
                        e._preventDefault();
                    }

                    var def;
                    var form = this;

                    /*
                    执行me.beforeSend方法，在成功，提交之前执行，
                    如果返回false就触发失败回调
                    可以返回deferred对象，进行异步操作
                    */
                    if (me.beforeSend && (def = me.beforeSend()) === false) {
                        K.handyWarn({
                            msg: me.beforeSend.errorMsg
                        });

                        me.emit('failure', [e]);
                        return;
                    }

                    // 如果是deferred对象，序列执行回调
                    if (def && (def = (def.pipe || def.then))) {
                        // 因为是异步操作，必须阻止默认表单提交，与异步提交表单不同
                        if(!e.isDefaultPrevented()) e._preventDefault();

                        return def(function () {
                            me.isDefaultPrevented = false;
                            me.emit('success', [e]);
                            // 提交表单
                            if(!me.isDefaultPrevented && !me.ajax) form.submit();
                        }, function(){
                            me.emit('failure', [e]);
                        });
                    } else {
                        me.emit('success', [e]);
                    }
                }
            });
        },
        validate: function () {
            /*
             [{
             elem: elem,
             msg: ''
             }, ...]
             */
            this.errHandler = [];

            var item;

            // 遍历配置项
            for (var i = 0, len = this.config.length; i < len; i++) {
                item = this.config[i];

                if(parseEachEleCfg(item) === false) continue;

                validating(item, this.errHandler);
            }

            item =  null;
        },
        // 解析HTML标签中的“data-valid”属性，将有的保存
        parseConfig: function () {
            var elems = $('*[data-valid]:not([disabled]):not([readonly])', this.form);
            var elem, ruler;

            for (var i = 0, len = elems.length; i < len; i++) {
                elem = elems[i];
                ruler = elem.getAttribute('data-valid');

                if (ruler)
                    this.config.push({
                        elem: elem,
                        type: ruler
                    });
            }
        },
        // 处理错误
        handleError: function () {
            var errs = this.errHandler;

            if (errs.length) {
                var head = errs.shift();
                var elem = head.elem;

                K.handyWarn({
                    msg: head.msg,
                    rel: elem,
                    relPos: 'right'
                });

                if (elem.value) {
                    elem.select();
                } else {
                    elem.focus();
                }
            }
        }
    };

    // 验证值，如果不符则保存到错误队列中
    function validating(item, errHandler) {
        var checkers = item.checker;
        var description, checker, value, args, elem;

        for(var i = 0, len = checkers.length; i < len; i++) {
            checker = checkers[i].checker;
            description = checkers[i].description;
            elem = item.elem;

            value = elem[formHooks[elem.type.toLowerCase()] || 'value'];

            // fix IE用value兼容HTML5的placeholder
            if(elem.getAttribute('placeholder') === value) {
                value = '';
            }

            if (value && typeof value === 'string') {
                value = Validator.encodeValue(value);
            }

            args = description ? [value, description] : [value];

            if (!checker.validate.apply(elem, args)) {
                errHandler.push({
                    elem: elem,
                    msg: typeof checker.msg === 'function' ? checker.msg.apply(elem, args) : checker.msg
                });
            }
        }
    }

    function parseEachEleCfg(item){
        if (!(item.checker && item.checker.length)) {
            var type, description, checker;
            var types = item.type && item.type.split(r_space) || [];

            if (!types.length) return false;

            // 单个元素可以有多个checker，以空格分隔，且单个checker可有相应的描述语
            // “charLen:24”， “：”后面跟随描述语，
            // 描述语用在错误信息中
            item.checker = [];
            for (var i = 0, len = types.length; i < len; i++) {
                type = types[i].split(':');
                description = type[1];
                checker = VALIDTYPES[type[0]];

                if (!checker) {
                    __console.error('没有相应的验证规则:' + type);
                    continue;
                }

                item.checker.push({
                    checker: checker,
                    description: description || ''
                });
            }
        }

        return true;
    }

    return Validator;
}());

