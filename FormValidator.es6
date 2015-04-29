/**
 * User: Luke
 * Date: 13-11-18
 */

/**
 *
 * @example:
 *
 * jade:
 *
 *  form
 h2.title 手机验证
 fieldset
 ul.reg-info
 li
 span 手机号
 input#mobile(name='mobile', type='text', data-valid="nonEmpty phone")
 li
 span 验证码
 input#validCode(name='validCode', type='text', data-valid="nonEmpty")
 a.get-valid-code 获取短信验证码

 input(type="submit", value="下一步")
 *
 *
 * js:

 new Validator({
        form: $('#register1-form'),
        formElementsEvented: true,
        beforeSend() {
            let def = $.Deferred();
            let mobile = $('#mobile').val();
            let validCode = $('#validCode').val();

            $.ajax({
                url: '/validUser',
                type: 'GET',
                dataType: 'json',
                data: {
                    mobile: mobile,
                    validCode: validCode
                }
            })
                .then((resp) => {
                    if(resp && resp.success) def.resolve();
                    else def.reject((resp && resp.errormsg) || '获取验证码失败');
                }, (msg) => {
                    def.reject(msg || '获取验证码失败');
                });

            return def.promise();
        },
        success() {
            alert('success');
        }
    });

 */


/**
 * 验证器
 * @param {Object} formInstance
 * @constructor Validator
 */

let r_space = /\s+/;

// HTML转义
let ENCODECHAR = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;'
};

// 验证策略
let VALIDTYPES = {
    'nonEmpty': {
        validate (value) {
            return value !== '';
        },
        msg: '此项不能为空'
    },
    'email': {
        validate (value) {
            return (/^[\w\-]+@[\w\-]+(?:\.[\w\-]+)+$/.test(value));
        },
        msg (value) {
            return (value ? '请输入正确格式的邮箱' : '请输入你的邮箱');
        }
    },
    'phone': {
        validate (value) {
            return (/^1[3458]\d{9}$/.test(value));
        },
        msg (value) {
            return (value ? '请输入正确格式的手机号码' : '请输入你的手机号码');
        }
    }
};

let formHooks = {
    'radio': 'checked',
    'checkbox': 'checked'
};

let formEventsHooks = {
    'text': formEventsGetter('blur'),
    'textarea': formEventsGetter('blur'),
    'checkbox': formEventsGetter('click'),
    'select': formEventsGetter('change'),
    'radio': formEventsGetter('click')
};

function formEventsGetter(type) {
    return (el, context, item) => {
        $(el).on(type, () => {
            context.errHandler = [];
            parseEachEleCfg(item);

            validating(item, context.errHandler);

            if (context.errHandler.length) context.handleError();
            else $(el).siblings('.error-msg').remove();
        });
    };
}

function showErrMsg(obj) {
    let $elem = $(obj.elem);
    let msg = obj.msg;
    let $errElem = $elem.siblings('.error-msg');

    if (!$errElem.length) {
        $errElem = $('<i class="error-msg">' + msg + '</i>');
        $errElem.insertAfter($elem);
    } else {
        $errElem.text(msg);
    }
}

/**
 * 验证器构造器
 * @param {Object} formInstance 用户自定义规则
 * @constructor
 */
export class Validator {
    constructor(formInstance) {
        let form = formInstance.form;
        if (!form) return;

        this.form = form;

        /**
         [{
            elem:elem,
            value: '',
            type: ''
            [optional] ,checker: {checker: func, description: ''}
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

        if (formInstance.types) $.extend({}, VALIDTYPES, formInstance.types || {});

        this.parsed = false;
        this.isDefaultPrevented = false;
        this.ajax = typeof formInstance.ajax === 'boolean' ?
            formInstance.ajax : true;
        // 错误信息提示
        this.showErrMsg = formInstance.showErrMsg || showErrMsg;

        if (formInstance.success) this.on('success', formInstance.success);
        if (formInstance.failure) this.on('failure', formInstance.failure);
        if (formInstance.beforeSend) this.beforeSend = formInstance.beforeSend;

        if (formInstance.formElementsEvented) {
            this.parseConfig();
            this.parsed = true;
            this.addFormEvents(this.config);
        }

        this.on('success', removeClassFn);
        this.on('failure', removeClassFn);

        this.submit();
    }

    static encodeValue(value) {
        for (let i in ENCODECHAR)
            if (ENCODECHAR.hasOwnProperty(i))
                value = value.replace(new RegExp(i, 'g'), ENCODECHAR[i]);

        return value;
    }

    // 为每个表单元素添加事件侦听
    addFormEvents (cfg) {
        let me = this;
        let elem, formType, item;
        for (let i = 0, len = cfg.length; i < len; i++) {
            item = cfg[i];
            elem = item.elem;
            formType = elem.type;

            formEventsHooks[formType](elem, me, item);
        }
    }
    hasErrors () {
        return !!this.errHandler.length;
    }
    on (type, cb) {
        if (!this.callbackLists[type])
            throw new Error('no matched event type');

        this.callbackLists[type] = this.callbackLists[type].concat(
            Object.prototype.toString.call(cb) === '[object Array]' ?
                cb : [cb]
        );
    }
    off (type) {
        if (!this.callbackLists[type]) return;

        delete this.callbackLists[type];
    }
    emit (type, args) {
        if (!this.callbackLists[type])
            throw new Error('no matched event type');

        let list = this.callbackLists[type];

        if (type === 'failure' && args && args[0] && args[0].preventDefault)
            args[0].preventDefault();

        for (let i = 0, len = list.length; i < len; i++) {
            if (typeof list[i] === 'function' && list[i].apply(this.form, args) === false)
                break;
        }
    }
    submit () {
        let me = this;

        if (!this.form) return;

        $(this.form).on('submit', (e) => {
            let $this = $(e.currentTarget);

            if ($this.hasClass('processing')) return;

            $this.addClass('processing');

            me.isDefaultPrevented = false;
            e._preventDefault = e.preventDefault;
            e.preventDefault = () => {
                e._preventDefault();
                me.isDefaultPrevented = true;
            };

            // 解析配置，parsed为false时，可再次解析
            if (!me.parsed) {
                me.parseConfig();
                me.parsed = true;
            }

            $('.error-msg').remove();

            // 验证
            me.validate();

            // 验证有错误
            if (me.hasErrors()) {
                me.handleError(true);

                me.emit('failure', [e]);
                return;
            }

            // ajax提交默认阻止表单提交
            if (me.ajax) e._preventDefault();

            let def;
            let form = this;

            /*
            执行me.beforeSend方法，在成功，提交之前执行，
            如果返回false就触发失败回调
            可以返回deferred对象，进行异步操作
            */
            if (me.beforeSend && (def = me.beforeSend()) === false) {
                me.emit('failure', [e]);
                return;
            }

            // 如果是deferred对象，序列执行回调
            if (def && (typeof def.pipe === 'function' || typeof def.then === 'function')) {
                def = def.pipe || def.then;
                // 因为是异步操作，必须阻止默认表单提交，与异步提交表单不同
                if (!e.isDefaultPrevented()) e._preventDefault();

                return def(() => {
                    me.isDefaultPrevented = false;
                    me.emit('success', [e]);
                    // 提交表单
                    if (!me.isDefaultPrevented && !me.ajax) form.submit();
                }, () => {
                    me.emit('failure', [e]);
                });
            } else {
                me.emit('success', [e]);
            }
        });
    }
    validate () {
        /**
         [{
                elem: elem,
                msg: ''
             }, ...]
         */
        this.errHandler = [];

        let item;

        // 遍历配置项
        for (let i = 0, len = this.config.length; i < len; i++) {
            item = this.config[i];

            if (parseEachEleCfg(item) === false) continue;

            validating(item, this.errHandler);
        }
    }
    // 解析HTML标签中的“data-valid”属性，将有的保存
    parseConfig () {
        let elems = $('*[data-valid]:not([disabled]):not([readonly])', this.form);
        let elem, ruler;

        for (let i = 0, len = elems.length; i < len; i++) {
            elem = elems[i];
            ruler = elem.getAttribute('data-valid');

            if (ruler)
                this.config.push({
                    elem: elem,
                    type: ruler
                });
        }
    }
    // 处理错误
    handleError (showAll) {
        let errs = this.errHandler;

        if (errs.length) {
            let head = errs.shift();
            let elem = head.elem;

            if (showAll) {
                do {
                    elem = head.elem;

                    this.showErrMsg({
                        msg: head.msg,
                        elem: elem
                    });
                } while ((head = errs.shift()));
            } else {
                this.showErrMsg({
                    msg: head.msg,
                    elem: elem
                });

                if (!$(elem).siblings('.error-msg').length)
                    if (elem.value) elem.select();
                    else elem.focus();

                elem = null;
            }
        }
    }
}


function removeClassFn(e) {
    $(e.target).removeClass('processing');
}

// 验证值，如果不符则保存到错误队列中
function validating(item, errHandler) {
    let checkers = item.checker;
    let description, checker, value, args, elem;

    for (let i = 0, len = checkers.length; i < len; i++) {
        checker = checkers[i].checker;
        description = checkers[i].description;
        elem = item.elem;

        value = elem[formHooks[elem.type.toLowerCase()] || 'value'];

        // fix IE用value兼容HTML5的placeholder
        if (elem.getAttribute('placeholder') === value)
            value = '';

        //if (value && typeof value === 'string') {
        //    value = Validator.encodeValue(value);
        //}

        args = [value].concat(description);

        if (!checker.validate.apply(elem, args))
            errHandler.push({
                elem: elem,
                msg: typeof checker.msg === 'function' ? checker.msg.apply(elem, args) : checker.msg
            });
    }
}

let r_brackets = /^([\w-]+)(?:\(([^)]+)\)|)$/;

function parseEachEleCfg(item) {
    if (!(item.checker && item.checker.length)) {
        let type, description, checker;
        let types = item.type && item.type.split(r_space) || [];

        if (!types.length) return false;

        // 单个元素可以有多个checker，以空格分隔，且单个checker可有相应的描述语
        // “charLen(24)”， 括号里面是描述语，
        // 描述语用在错误信息中
        item.checker = [];
        for (let i = 0, len = types.length; i < len; i++) {
            type = types[i].match(r_brackets);
            if (!type) continue;
            checker = VALIDTYPES[type[1]];
            description = type[2] && type[2].split(',') || [];

            if (!checker) {
                console.error('没有相应的验证规则:' + type);
                continue;
            }

            item.checker.push({
                checker: checker,
                description: description
            });
        }
    }

    return true;
}
