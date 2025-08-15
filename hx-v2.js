/** hx-v2.js - Lightweight UI, State & Utility Library */
const hx = {

    // ---- Core Rendering ----
    createFragmentFromString(str) {
        const fragment = document.createDocumentFragment();
        const temp = document.createElement("div");
        temp.innerHTML = str.trim();
        while (temp.firstChild) fragment.appendChild(temp.firstChild);
        return fragment;
    },

    createFragmentFromTextNode(content) {
        const fragment = document.createDocumentFragment();
        fragment.appendChild(document.createTextNode(content));
        return fragment;
    },

    generateFragment(structure) {
        function createElement(tag, attributes) {
            const element = document.createElement(tag);
            for (const key in attributes) {
                if (key.startsWith("$")) {
                    const childTag = key.slice(1);
                    const children = attributes[key];
                    if (Array.isArray(children)) {
                        children.forEach(child => element.appendChild(createElement(childTag, child)));
                    } else {
                        element.appendChild(createElement(childTag, children));
                    }
                } else if (key === "text") {
                    element.textContent = typeof attributes[key] === "function" ? attributes[key]() : attributes[key];
                } else if (typeof attributes[key] === "function" && key.startsWith("on")) {
                    element.addEventListener(key.substring(2), attributes[key]);
                } else {
                    element.setAttribute(key, attributes[key]);
                }
            }
            return element;
        }
        const rootKey = Object.keys(structure)[0];
        return createElement(rootKey.replace("$", ""), structure[rootKey]);
    },

    render(structure, container = document.body, { replace = false } = {}) {
        if (typeof container === "string") container = document.getElementById(container);
        if (!container) throw new Error(`Container not found`);
        if (replace) container.innerHTML = "";

        let fragment;
        if (typeof structure === "string") fragment = this.createFragmentFromString(structure);
        else if (typeof structure !== "object") fragment = this.createFragmentFromTextNode(structure);
        else fragment = this.generateFragment(structure);

        container.appendChild(fragment);
        return container;
    },

    // ---- Show / Hide ----
    hide(el, duration = 300) {
        el.style.transition = `opacity ${duration}ms`;
        el.style.opacity = "0";
        setTimeout(() => el.style.display = "none", duration);
        return el;
    },
    show(el, duration = 300, displayStyle = "block") {
        el.style.display = displayStyle;
        el.style.opacity = "0";
        el.style.transition = `opacity ${duration}ms`;
        requestAnimationFrame(() => el.style.opacity = "1");
        return el;
    },

    // ---- Small DOM helpers ----
    attr(el, attrs) { Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); return el; },
    css(el, styles) { Object.assign(el.style, styles); return el; },

    each(array, fn) { return array.map(fn); },
    if(cond, structure) { return cond ? structure : {}; },

    // ---- Reactive State ----
    state(obj) {
        const subs = new Set();
        const notify = () => subs.forEach(fn => fn());
        const p = new Proxy(obj, {
            set(t, k, v) { t[k] = v; notify(); return true; }
        });
        p.subscribe = fn => subs.add(fn);
        return p;
    },

    // ---- Forms ----
    serializeForm(form) {
        const fd = new FormData(form);
        const data = {};
        fd.forEach((v, k) => data[k] = v);
        return data;
    },
    handleFormSubmit(form, cb) {
        form.addEventListener("submit", e => { e.preventDefault(); cb(this.serializeForm(form)); });
    },
    fillForm(form, data) {
        Object.entries(data).forEach(([k, v]) => { if (form.elements[k]) form.elements[k].value = v; });
    },

    // ---- Components ----
    _components: {},
    component(name, fn) { this._components[name] = fn; },
    mount(name, props, container, opts) {
        if (!this._components[name]) throw new Error(`Component ${name} not found`);
        this.render(this._components[name](props), container, opts);
    },

    // ---- Event Delegation ----
    on(container, event, selector, handler) {
        if (typeof container === "string") container = document.querySelector(container);
        container.addEventListener(event, e => {
            if (e.target.closest(selector)) handler(e);
        });
    },

    // ---- Storage helpers ----
    store: {
        set(key, value, session = false) {
            const s = session ? sessionStorage : localStorage;
            s.setItem(key, JSON.stringify(value));
        },
        get(key, session = false) {
            const s = session ? sessionStorage : localStorage;
            const v = s.getItem(key);
            return v ? JSON.parse(v) : null;
        }
    }
};

// Extended HX-like behaviors loader
function initHtmxBehaviors() {
    document.addEventListener("click", e => {
        const el = e.target.closest("[hx-get],[hx-post],[hx-put],[hx-delete]");
        if (el) {
            e.preventDefault();
            const attr = ["hx-get", "hx-post", "hx-put", "hx-delete"].find(a => el.hasAttribute(a));
            const url = el.getAttribute(attr);
            const targetSel = el.getAttribute("hx-target");
            const tgt = document.querySelector(targetSel);
            if (!tgt) return;
            hx.hide(tgt, 200);
            fetch(url, { method: attr.split("-")[1].toUpperCase() })
                .then(r => r.text())
                .then(html => { tgt.innerHTML = html; hx.show(tgt, 300); })
                .catch(err => { tgt.innerHTML = `<div style="color:red">Error: ${err}</div>`; });
        }
    });
}