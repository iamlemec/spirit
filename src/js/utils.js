// various general tools

export { OrderedSet, Multimap, DefaultCounter }

class OrderedSet {
    constructor() {
        this.set = new Set();
        this.arr = [];
    }

    add(item) {
        if (!this.set.has(item)) {
            this.set.add(item);
            this.arr.push(item);
        }
    }

    delete(item) {
        if (this.set.has(item)) {
            this.set.delete(item);
            let idx = this.arr.indexOf(item);
            this.arr.splice(idx, 1);
        }
    }

    has(item) {
        return this.set.has(item);
    }

    idx(item) {
        return this.arr.indexOf(item);
    }

    get(idx) {
        return this.arr[idx];
    }

    size() {
        return this.arr.length;
    }

    [Symbol.iterator]() {
        return this.arr[Symbol.iterator]();
    }
}

class Multimap {
    constructor() {
        this.sets = new Map();
        this.locs = new Map();
    }

    add(loc, item) {
        if (this.locs.has(item)) {
            this.pop(item);
        }
        if (!this.sets.has(loc)) {
            this.sets.set(loc, new OrderedSet());
        }
        this.sets.get(loc).add(item);
        this.locs.set(item, loc);
    }

    has(item) {
        return this.locs.has(item);
    }

    idx(item) {
        if (this.locs.has(item)) {
            let loc = this.locs.get(item);
            return this.sets.get(loc).idx(item);
        } else {
            console.log(`Item ${item} not found`);
            return null;
        }
    }

    num(loc) {
        if (this.sets.has(loc)) {
            return this.sets.get(loc).size();
        } else {
            return 0;
        }
    }

    upd(dic) {
        for ([k, s] of dic) {
            for (v of s) {
                this.add(k, v);
            }
        }
    }

    pop(item) {
        if (this.locs.has(item)) {
            let loc = this.locs.get(item);
            this.locs.delete(item);
            this.sets.get(loc).delete(item);
            if (this.sets.get(loc).size() == 0) {
                this.sets.delete(loc);
            }
            return loc;
        } else {
            console.log(`Item ${item} not found`);
            return null;
        }
    }

    get(loc) {
        if (this.sets.has(loc)) {
            return this.sets.get(loc);
        } else {
            console.log(`Set ${loc} not found`);
            return null;
        }
    }

    loc(item) {
        if (this.locs.has(item)) {
            return this.locs.get(item);
        } else {
            console.log(`Item ${item} not found`);
            return null;
        }
    }
}

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
