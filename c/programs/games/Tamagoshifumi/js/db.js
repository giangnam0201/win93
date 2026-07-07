const indexedDB =
  window.indexedDB ||
  window.webkitIndexedDB ||
  window.mozIndexedDB ||
  window.OIndexedDB ||
  window.msIndexedDB;

export default class DB {
  constructor(name = "db", storeName = "store", version = 1) {
    const opt = typeof name === "string" ? { name, storeName, version } : name;
    Object.assign(this, opt);

    let shouldPopulate = false;

    this.ready = new Promise((resolve, reject) => {
      const open = indexedDB.open(this.name, this.version);
      const timeout = setTimeout(() => {
        reject(new Error("Timed out"));
      }, 3000);

      open.onupgradeneeded = ({ target }) => {
        this.db = target.result;
        this.store = this.db.createObjectStore(this.storeName);
        shouldPopulate = true;
      };
      open.onsuccess = ({ target }) => {
        clearTimeout(timeout);
        this.db = target.result;
        resolve(this);
        if (shouldPopulate && typeof this.populate === "function")
          this.populate();
      };
      open.onerror = open.onblocked = err => {
        clearTimeout(timeout);
        reject(err);
      };
    });

    const action = verb => async (...args) => {
      await this.ready;
      this.tx = this.db.transaction(this.storeName, "readwrite");
      this.store = this.tx.objectStore(this.storeName);
      const res = this.store[verb](...args);
      return await new Promise((resolve, reject) => {
        res.onsuccess = () => resolve(res.result);
        res.onerror = reject;
      });
    };

    this.set = async (...args) => {
      if (args === 2) {
        this.put(...args.reverse());
      } else throw new RangeError("Wrong number of arguments");
    };

    this.put = action("put");
    this.get = action("get");
    this.delete = action("delete");
    this.clear = action("clear");
    this.getAll = action("getAll");
    this.getAllKeys = action("getAllKeys");

    this.find = predicate =>
      new Promise((resolve, reject) => {
        this.tx = this.db.transaction(this.storeName, "readonly");
        this.store = this.tx.objectStore(this.storeName);
        const items = [];
        this.tx.oncomplete = () => resolve([this, items]);
        this.tx.onerror = reject;
        const cursor = this.store.openCursor();
        cursor.onerror = console.log;
        cursor.onsuccess = async e => {
          const cursor = e.target.result;
          if (cursor) {
            const res = await predicate(cursor);
            if (res !== false) {
              if (res === true) items.push(cursor.value);
              cursor.continue();
            }
          }
        };
      });
  }
}

DB.indexedDB = indexedDB;

DB.ok = !!indexedDB;
