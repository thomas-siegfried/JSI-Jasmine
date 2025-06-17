import { Injector } from "@thomas-siegfried/jsi";
const WILDCARD: string = "*";
export class AutoMocker {
  constructor(public injector: Injector = null) {
    if (!this.injector) {
      this.injector = new Injector();
    }
  }
  Resolve<T>(key: Constructor<T>): T;
  Resolve<T>(key: any): T;
  Resolve<T = any>(key: any) {
    return this.injector.Resolve<T>(key);
  }

  // ResolveT<T>(key: Constructor<T>) {
  //   return this.injector.Resolve<T>(key);
  // }
  //configure a type for auto prop behavior
  //we can set any property and get back the value we set
  AutoProp(key: any) {
    var pxy = this.injector.Proxy(key);
    var autoObjMap = new Map();
    const getAutoObj = (obj) => {
      if (!autoObjMap.has(obj)) {
        autoObjMap.set(obj, {});
      }
      return autoObjMap.get(obj);
    };
    pxy.get(WILDCARD).instead((obj, prop) => {
      return getAutoObj(obj)[prop];
    });
    pxy.set(WILDCARD).instead((obj, prop, val) => {
      getAutoObj(obj)[prop] = val;
    });
  }

  //All of the objects methods and props will return null
  Stub(key: any, autoProp: boolean = false) {
    var pxy = this.injector.Proxy(key);
    pxy.fn(WILDCARD).instead(() => null);
    if (autoProp) {
      //setup automatic properties
      this.AutoProp(key);
    } else {
      //setup stubbed properties
      pxy.get(WILDCARD).instead(() => null);
      pxy.set(WILDCARD).instead(() => {});
    }
  }

  //specific method will be a spy, returned to caller
  Mock(key: any, Method: string): jasmine.Spy {
    var spy = jasmine.createSpy();
    var pxy = this.injector.Proxy(key);
    pxy.fn(Method).instead((obj, name, args) => spy(...args));
    return spy;
  }
  Type<T>(key: Constructor<T>): TypeMocker<T>;
  Type<T>(key: any): TypeMocker<T>;
  Type<T>(key: Constructor<T> | any): TypeMocker<T> {
    return new TypeMocker<T>(key, this);
  }

  // TypeT<T>(key: Constructor<T>): TypeMocker<T> {
  //   return new TypeMocker<T>(key, this);
  // }

  //override the get result of a specific property
  Get(key: any, prop: string): jasmine.Spy {
    var spy = jasmine.createSpy();
    var pxy = this.injector.Proxy(key);
    pxy.get(prop).instead(() => spy());
    return spy;
  }

  Set(key: any, prop: string): jasmine.Spy {
    var spy = jasmine.createSpy();
    var pxy = this.injector.Proxy(key);
    pxy.set(prop).instead((t, p, v) => spy(v));
    return spy;
  }

  private isolatedTypes: any[];

  Isolate(key: any | any[]) {
    if (!Array.isArray(key)) {
      key = [key];
    }
    if (!this.isolatedTypes) {
      this.isolatedTypes = [];
      this.injector.callbacks.Resolve = (key, stack) => {
        //anything that gets requested is a pure proxy unless it is on the isolate list
        if (this.isolatedTypes.indexOf(key) == -1 && key.prototype) {
          this.PureProxy(key, true);
        }
      };
    }
    this.isolatedTypes.push(...key);
  }
  //register a key to a factory returning dummy object based on key's prototype
  //this only works if the key is a constructor
  PureProxy(key: any, autoProp: boolean) {
    if (!key.prototype) {
      throw new Error();
    }
    this.injector.RegisterOptions({
      Key: key,
      Factory: () => Object.create(key.prototype),
    });
    this.Stub(key, autoProp);
  }
}

export interface Func<T, K = any> {
  (t: T): K;
}
export interface Func2<T, K> {
  (t: T): K;
}

export interface ReturnFunc<K> {
  (...args: any[]): K;
}

interface TypedFunction<P extends any[], R> {
  (...args: P): R;
}
// interface Action<T> {
//   (t: T): void;
// }

export class TypeMocker<T> {
  constructor(private key: any, private mocker: AutoMocker) {}

  //All of the objects methods will return null;
  Stub(autoProp: boolean = false) {
    this.mocker.Stub(this.key, autoProp);
    return this;
  }
  //mock a specific method, returns the spy, and thus breaks the fluency
  Mock<K = any, P extends any[] = any[]>(
    method: string | Func<T, TypedFunction<P, K>>
  ): jasmine.Spy<(...args: P) => K> {
    return this.mocker.Mock(this.key, this.GetMember(method)) as jasmine.Spy<
      (...args: P) => K
    >;
  }

  // MockT<K>(method: (t: T) => (...args: any[]) => K): jasmine.Spy<() => K> {
  //   var fn = this.parseFunction(method);
  //   return this.mocker.Mock(this.key, this.GetMember(fn)) as jasmine.Spy<
  //     () => K
  //   >;
  // }

  Get<K = any>(prop: string | Func<T, K>): jasmine.Spy<() => K> {
    return this.mocker.Get(this.key, this.GetMember(prop)) as jasmine.Spy<
      () => K
    >;
  }

  // GetT<K>(prop: (t: T) => K): jasmine.Spy<() => K> {
  //   var fn = this.parseFunction(prop);
  //   return this.mocker.Get(this.key, this.GetMember(fn)) as jasmine.Spy<
  //     () => K
  //   >;
  // }

  Set<K = any>(prop: string | Func<T, K>): jasmine.Spy<(T) => void> {
    return this.mocker.Set(this.key, this.GetMember(prop));
  }

  /*Do not create the object, return an instance based on prototype and stub all methods*/
  PureProxy(autoProp: boolean = false) {
    this.mocker.PureProxy(this.key, autoProp);
    return this;
  }

  private GetMember(member: string | Func<T>) {
    if (typeof member == "string") return member;
    else return this.parseFunction(member);
  }

  //brute force attempt to pull a member from a function simillar to Expression in C#
  //expects functions in the form of d=>d.Xyz or (d)=>d.abc etc
  private parseFunction(fn: (i: any) => any): string {
    let txt = fn.toString();
    let prm = txt.substring(0, txt.indexOf("=>")).replace(/[(|)]/g, "").trim();
    let rest = txt.substring(txt.indexOf("=>") + 2).trim();
    let member = rest.substring(prm.length + 1);
    return member;
  }
}

interface Constructor<T> {
  new (...args: any[]): T;
}
