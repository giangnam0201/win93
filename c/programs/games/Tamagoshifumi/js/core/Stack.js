export default class Stack extends Array {
  clear() {
    this.length = 0;
    return this;
  }

  add(item) {
    this.push(item);
    return this;
  }

  has(item) {
    return this.includes(item);
  }

  delete(item) {
    const i = this.indexOf(item);
    if (i !== -1) this.splice(i, 1);
    return this;
  }

  down(item) {
    const i = this.indexOf(item);
    if (i > 0) this.move(i, i - 1);
    return this;
  }

  up(item) {
    const i = this.indexOf(item);
    if (i !== -1) this.move(i, i + 1);
    return this;
  }

  top(item) {
    const i = this.indexOf(item);
    if (i !== -1) this.move(i, this.length);
    return this;
  }

  bottom(item) {
    const i = this.indexOf(item);
    if (i !== -1) this.move(i, 0);
    return this;
  }

  replace(a, b) {
    if (a !== b) {
      let i = this.indexOf(b);
      if (i !== -1) this.splice(i, 1);

      i = this.indexOf(a);
      if (i !== -1) this.splice(i, 1, b);
    }
    return this;
  }

  swap(a, b) {
    if (a !== b) {
      const ia = this.indexOf(a);
      const ib = this.indexOf(b);
      if (ia !== -1 && ib !== -1) {
        const tmp = this[ia];
        this[ia] = this[ib];
        this[ib] = tmp;
      }
    }
  }

  after(a, b) {
    const i = this.indexOf(b);
    if (i !== -1) {
      this.delete(a);
      this.splice(i + 1, 0, a);
    }
    return this;
  }

  move(from, to) {
    if (to >= this.length) to = this.length;
    this.splice(to, 0, this.splice(from, 1)[0]);
    return this;
  }

  count(a) {
    return this.filter(item => item === a).length;
  }
}
