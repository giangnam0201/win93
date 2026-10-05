export default class Pool extends Array {
  constructor(Constructor, size = 10) {
    super();
    this.Constructor = Constructor;
    this.size = size;
    this.ensure(size);
  }

  ensure(size = this.size) {
    if (!this.length) {
      for (let i = 0; i < size; i++) this.push(new this.Constructor());
    }
  }

  get() {
    this.ensure();
    return this.pop();
  }

  recycle(item) {
    this.push(item);
    return this;
  }
}
