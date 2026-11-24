// Mock for Node.js "stream" module in browser environment (e.g. used by xlsx / xlsx-js-style)
export class Readable {
  static from() {
    return new Readable();
  }
  pipe() {
    return this;
  }
  on() {
    return this;
  }
  once() {
    return this;
  }
  emit() {
    return false;
  }
}

export class Writable {
  write() {
    return true;
  }
  end() {
    return this;
  }
  on() {
    return this;
  }
  once() {
    return this;
  }
  emit() {
    return false;
  }
}

export class Transform extends Readable {}
export class Duplex extends Readable {}
export class PassThrough extends Transform {}

export const pipeline = () => {};

export default {
  Readable,
  Writable,
  Transform,
  Duplex,
  PassThrough,
  pipeline,
};
