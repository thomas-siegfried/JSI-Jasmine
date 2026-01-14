import { Injector } from "@thomas-siegfried/jsi";
const WILDCARD: string = "*";
export class AutoMocker {
  constructor(public injector: Injector = null) {
    if (!this.injector) {
      this.injector = new Injector();
    }
  }
  Resolve<T>(key: Constructor<T> | FactoryMethod<T>): T;
  Resolve<T>(key: string): T;
  Resolve<T = any>(key: any): T {
    return this.injector.Resolve<T>(key);
  }

  //spy tracking
  private spyMap = new Map<any, Map<string, jasmine.Spy>>();
  private cacheSpy(key: any, member: string, spy: jasmine.Spy) {
    if (!this.spyMap.has(key)) {
      this.spyMap.set(key, new Map());
    }
    this.spyMap.get(key)!.set(member, spy);
  }

  // To retrieve a spy:
  private getSpy(key: any, member: string): jasmine.Spy | undefined {
    return this.spyMap.get(key)?.get(member);
  }
  // ResolveT<T>(key: Constructor<T>) {
  //   return this.injector.Resolve<T>(key);
  // }
  //configure a type for auto prop behavior
  //we can set any property and get back the value we set
  AutoProp(key: any): AutoMocker {
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
    return this;
  }

  //All of the objects methods and props will return null
  Stub(key: any, autoProp: boolean = false): AutoMocker {
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
    return this;
  }

  //specific method will be a spy, returned to caller
  Mock(key: any, Method: string): jasmine.Spy {
    var spy = this.getSpy(key, Method);
    if (!spy) {
      spy = jasmine.createSpy();
      var pxy = this.injector.Proxy(key);
      pxy.fn(Method).instead((obj, name, args) => spy(...args));
      this.cacheSpy(key, Method, spy);
    }
    return spy;
  }
  Type<T>(
    key: Constructor<T>,
    configureAction?: Action<TypeMocker<T>>
  ): TypeMocker<T>;
  Type<T>(key: any, configureAction?: Action<TypeMocker<T>>): TypeMocker<T>;
  Type<T>(
    key: Constructor<T> | any,
    configureAction: Action<TypeMocker<T>> = null
  ): TypeMocker<T> {
    const typeMocker = new TypeMocker<T>(key, this);
    if (configureAction) configureAction(typeMocker);
    return typeMocker;
  }

  // TypeT<T>(key: Constructor<T>): TypeMocker<T> {
  //   return new TypeMocker<T>(key, this);
  // }

  //override the get result of a specific property
  Get(key: any, prop: string): jasmine.Spy {
    const spyKey = `_GET_${prop}`;
    var spy = this.getSpy(key, spyKey);
    if (!spy) {
      spy = jasmine.createSpy();
      var pxy = this.injector.Proxy(key);
      pxy.get(prop).instead(() => spy());
      this.cacheSpy(key, spyKey, spy);
    }
    return spy;
  }

  Set(key: any, prop: string): jasmine.Spy {
    const spyKey = `_SET_${prop}`;
    var spy = this.getSpy(key, spyKey);
    if (!spy) {
      spy = jasmine.createSpy();
      var pxy = this.injector.Proxy(key);
      pxy.set(prop).instead((t, p, v) => spy(v));
      this.cacheSpy(key, spyKey, spy);
    }
    return spy;
  }

  private _verifications: Array<() => void> = [];
  //setup a validation to perform at the end
  Verify<T extends jasmine.Func>(
    spy: jasmine.Spy<T>,
    matcher: Action<jasmine.FunctionMatchers<T>>
  ) {
    this._verifications.push(() => {
      matcher(expect(spy));
    });
  }
  //call at the end of the test to perform all validations
  VerifyAll() {
    for (const validator of this._verifications) {
      validator();
    }
  }

  private isolatedTypes: any[];

  //ensure that ONLY the types provided here are constructed, all other types will be Proxies
  Isolate(key: any | any[]): AutoMocker {
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
    return this;
  }
  //register a key to a factory returning dummy object based on key's prototype
  //this only works if the key is a constructor
  PureProxy(key: any, autoProp: boolean): AutoMocker {
    if (!key.prototype) {
      throw new Error();
    }
    this.injector.RegisterOptions({
      Key: key,
      Factory: () => Object.create(key.prototype),
    });
    this.Stub(key, autoProp);
    return this;
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
interface Action<T> {
  (t: T): void;
}

export class TypeMocker<T> {
  constructor(private key: any, private mocker: AutoMocker) {}

  //All of the objects methods will return null;
  Stub(autoProp: boolean = false) {
    this.mocker.Stub(this.key, autoProp);
    return this;
  }
  //mock a specific method, returns the spy, and thus breaks the fluency
  Mock<K = any, P extends any[] = any[]>(
    method: string | Func<T, TypedFunction<P, K>>,
    configure: (
      spy: jasmine.Spy<(...args: P) => K>,
      verify: Action<Action<jasmine.FunctionMatchers<(...args: P) => K>>>
    ) => void = null
  ): jasmine.Spy<(...args: P) => K> {
    const spy = this.mocker.Mock(
      this.key,
      this.GetMember(method)
    ) as jasmine.Spy<(...args: P) => K>;
    if (configure) configure(spy, (act) => this.mocker.Verify(spy, act));
    return spy;
  }
  //configuration method, allows multi line setup without declaring a variable
  Configure(setupAction: Action<TypeMocker<T>>): TypeMocker<T> {
    setupAction(this);
    return this;
  }

  // MockT<K>(method: (t: T) => (...args: any[]) => K): jasmine.Spy<() => K> {
  //   var fn = this.parseFunction(method);
  //   return this.mocker.Mock(this.key, this.GetMember(fn)) as jasmine.Spy<
  //     () => K
  //   >;
  // }

  Get<K = any>(
    prop: string | Func<T, K>,
    configure: (
      spy: jasmine.Spy<() => K>,
      verify: Action<Action<jasmine.FunctionMatchers<() => K>>>
    ) => void = null
  ): jasmine.Spy<() => K> {
    const spy = this.mocker.Get(this.key, this.GetMember(prop)) as jasmine.Spy<
      () => K
    >;
    if (configure) {
      configure(spy, (act) => this.mocker.Verify(spy, act));
    }
    return spy;
  }

  // GetT<K>(prop: (t: T) => K): jasmine.Spy<() => K> {
  //   var fn = this.parseFunction(prop);
  //   return this.mocker.Get(this.key, this.GetMember(fn)) as jasmine.Spy<
  //     () => K
  //   >;
  // }

  Set<K = any>(
    prop: string | Func<T, K>,
    configure: (
      spy: jasmine.Spy<(k: K) => void>,
      verify: Action<Action<jasmine.FunctionMatchers<(K) => void>>>
    ) => void = null
  ): jasmine.Spy<(k: K) => void> {
    let spy = this.mocker.Set(this.key, this.GetMember(prop));
    if (configure) {
      configure(spy, (act) => this.mocker.Verify(spy, act));
    }
    return spy;
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

export type FactoryMethod<T> = (...params: any[]) => T;

export type Constructor<T> = new (...args: any[]) => T;
