// various general tools


class DefaultCounter {
    constructor() {
        this.values = new Map();
    }

    inc(key) {
        let val = !this.values.has(key) ? 1 : this.values.get(key) + 1;
        this.values.set(key, val);
        return val;
    }

    get(key) {
        return this.values.get(key);
    }
}

class EventTargetPlus extends EventTarget {
    emit(cmd, data) {
        if (data == null) {
            this.dispatchEvent(
                new Event(cmd)
            );
        } else {
            this.dispatchEvent(
                new CustomEvent(cmd, {detail: data})
            );
        }
    }
}

export { DefaultCounter, EventTargetPlus };
