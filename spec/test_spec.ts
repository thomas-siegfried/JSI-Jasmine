import {
  Person,
  LoginModel,
  LoginService,
  LoginValidator,
  ClassIDontWantToCreateInMyTest,
} from "./sampleTypes";
import { AutoMocker } from "../src/index";

function isProxy(obj: any): boolean {
  return (
    obj &&
    typeof obj === "object" &&
    Object.prototype.toString.call(obj) === "[object Proxy]"
  );
}

describe("AutoMocker", () => {
  var mkr: AutoMocker;
  beforeEach(() => {
    mkr = new AutoMocker();
  });
  it("Can automock properties of a type", () => {
    mkr.AutoProp(Person);
    var person = mkr.Resolve<Person>(Person);
    person.firstname = "FirstName";
    person.lastname = "LastName";
    expect(person.firstname).toBe("FirstName"); //properties can set/get
    expect(person.lastname).toBe("LastName");
    expect(person.fullname).toBeUndefined(); //any unset property is undefined
  });

  it("can stub all methods of a type, causing them to return null", () => {
    mkr.Stub(LoginService);
    let ls = mkr.Resolve<LoginService>(LoginService);
    var res = ls.Login("", "");
    expect(res).toBeNull();
  });

  it("can override specific stubbed properties", () => {
    mkr.Stub(LoginService);
    var logoutSpy = mkr.Mock(LoginService, "Logout").and.returnValue(true);
    let ls = mkr.Resolve<LoginService>(LoginService);
    var res = ls.Login("", "");
    expect(res).toBeNull();
    expect(ls.Logout()).toBeTrue(); //
    expect(logoutSpy).toHaveBeenCalled();
  });

  it("Can Isolate a specific type, stubbing all others", () => {
    mkr.Isolate(LoginModel);
    var vm = mkr.Resolve<LoginModel>(LoginModel);
    vm.username = "test";
    vm.password = "test";
    expect(vm.IsValid()).toBe(true); //isolated class executes code normally
    expect(vm.Submit()).toBeNull(); //stub service will return null;
  });

  it("Can Isolate multiple types", () => {
    mkr.Isolate([LoginModel, LoginValidator]);
    var vm = mkr.Resolve<LoginModel>(LoginModel);
    expect(vm.SubmitWithExternalValidation()).toBeFalse(); //actual validator told us not to login
    vm.username = vm.password = "test"; //set username and password
    expect(vm.SubmitWithExternalValidation()).toBe(null); //calls through to login service, which is a stub
  });

  it("Can create fluent style typeMocker", () => {
    var spy = mkr
      .Type<LoginService>(LoginService)
      .Stub(true)
      .Mock("Login")
      .and.returnValue(true);
    var vm = mkr.Resolve<LoginModel>(LoginModel);
    vm.username = "user";
    vm.password = "pass";
    expect(vm.Submit()).toBeTrue();
    expect(spy).toHaveBeenCalled();
  });

  it("Can mock methods using typed functions", () => {
    var mkLogin = mkr.Type<LoginService>(LoginService);
    mkLogin.Stub(true);
    var spyLogin = mkLogin.Mock((c) => c.Login).and.returnValue(true); //login returns true
    var vm = mkr.Resolve<LoginModel>(LoginModel);
    vm.username = "user";
    vm.password = "pass";
    expect(vm.Submit()).toBeTrue(); //returns value from mock
    expect(spyLogin).toHaveBeenCalled(); //verify mock was called
  });

  it("can stub a property default value using fluent conventions", () => {
    mkr
      .Type<LoginService>(LoginService)
      .Get((c) => c.ServiceName)
      .and.returnValue("Override");
    var vm = mkr.Resolve<LoginModel>(LoginModel);
    expect(vm.GetServiceName()).toBe("Override");
  });

  it("can mock a property and validate a property get", () => {
    var pMock = mkr.Type<Person>(Person);
    var spyFName = pMock.Get((p) => p.firstname).and.returnValue("Setup");

    var person = mkr.Resolve<Person>(Person); //resolve the mock
    expect(person.firstname).toBe("Setup");
    expect(spyFName).toHaveBeenCalled();
  });

  it("can validate a property set", () => {
    var pMock = mkr.Type<Person>(Person);
    var spySetter = pMock.Set((p) => p.firstname);

    var person = mkr.Resolve<Person>(Person); //resolve the mock
    person.firstname = "...something new";
    expect(spySetter).toHaveBeenCalled();
  });

  it("returns null from all properties if not automocked or spied on", () => {
    var pMock = mkr.Type<Person>(Person);
    pMock.Stub();
    var person = mkr.Resolve<Person>(Person); //resolve the mock
    person.firstname = "...something new";
    expect(person.firstname).toBeFalsy();
  });

  it("calls mocked methods with correct values so that we can validate the call correctly", () => {
    var pMock = mkr.Type(LoginService);
    var spy = pMock.Mock((p) => p.Login).and.returnValue(true);
    var svc = mkr.Resolve(LoginService);
    expect(svc.Login("test", "method")).toBeTrue();
    expect(spy).toHaveBeenCalledWith("test", "method");
  });

  it("can infer constructor types using the Type method", () => {
    var pMock = mkr.Type(Person);
    pMock.Stub();
    pMock.Get((p) => p.firstname).and.returnValue("test");
  });

  it("can infer constructor types of constructors with parameters", () => {
    var pMock = mkr.Type(LoginModel);
    pMock.Stub();
    pMock.Mock((p) => p.IsValid).and.returnValue(true);
    mkr.Resolve(LoginModel);
  });

  it("can create pureProxies with mocked functions without creating the object", () => {
    var pMock = mkr.Type(ClassIDontWantToCreateInMyTest);
    pMock
      .PureProxy(false)
      .Mock((t) => t.ThrowError)
      .and.returnValue(1);
    var obj = mkr.Resolve(ClassIDontWantToCreateInMyTest);
    expect(obj.ThrowError()).toBe(1);
  });

  it("can infer types from mocked props and methods", () => {
    //this is not really a test, just a reminder
    var lmMock = mkr.Type(LoginModel);
    lmMock.Mock((m) => m.Submit).and.returnValue(true); //cannot specifiy a non-boolean
  });

  it("can infer typed spies for properties", () => {
    var pMock = mkr.Type(LoginModel);
    pMock.Get((m) => m.username).and.returnValue("test");
  });

  it("can isolate a type so that all non-isolated types are pure proxies", () => {
    mkr.Isolate(LoginModel);
    //this should be a pure mock
    //i can create it
    var tst = mkr.Resolve(ClassIDontWantToCreateInMyTest);
    //properties return null
    expect(tst.ThrowError()).toBeNull();
  });

  it("returns non proxied instances of isolated types", () => {
    mkr.Isolate(LoginModel);
    var login = mkr.Resolve(LoginModel);
    login.username = "test";
    login.password = "test";
    expect(login.username).toBe("test");
    expect(login.IsValid()).toBeTrue();
  });

  it("pure isolate proxies can still be mocked", () => {
    mkr.Isolate(LoginModel);
    mkr
      .Type(ClassIDontWantToCreateInMyTest)
      .Mock((c) => c.DummyMethod)
      .and.returnValue(5);
    //this should be a pure mock
    //i can create it
    var tst = mkr.Resolve(ClassIDontWantToCreateInMyTest);
    //methods return null
    expect(tst.DummyMethod()).toBe(5);
  });

  it("mock methods with params can be mocked using Mock", () => {
    mkr.Isolate(LoginModel);
    mkr
      .Type(ClassIDontWantToCreateInMyTest)
      .Mock((c) => c.ParamMethod)
      .and.returnValue(5);
    //this should be a pure mock
    //i can create it
    var tst = mkr.Resolve(ClassIDontWantToCreateInMyTest);
    //methods return null
    expect(tst.ParamMethod(0)).toBe(5);
  });

  it("can configure mocks after an object is requested", () => {
    mkr.Isolate(LoginModel);
    const serviceName = "mockvalue";

    const model = mkr.Resolve(LoginModel);
    var mock = mkr.Type(LoginService);
    mock.Mock((f) => f.Login).and.returnValue(true);
    mock.Get((f) => f.ServiceName).and.returnValue(serviceName);

    expect(model.GetServiceName()).toBe(serviceName);
  });

  it("can mock types keyed as strings", () => {
    mkr.injector.Register("test", [], () => {
      return { name: "myvalue" };
    });

    mkr.Type<any>("test").Get("name").and.returnValue("mockvalue");

    var obj = mkr.Resolve<any>("test");
    expect(obj.name).toBe("mockvalue");
  });
  it("can mock types keyed as strings a different way", () => {
    mkr.injector.Register("test", [], LoginService);

    mkr
      .Type<LoginService>("test")
      .Get((s) => s.ServiceName)
      .and.returnValue("mockvalue");

    var obj = mkr.Resolve<LoginService>("test");
    expect(obj.ServiceName).toBe("mockvalue");
  });
  describe("New Generics", () => {
    it("can infer types using Mock()", () => {
      mkr
        .Type(LoginService)
        .Mock((s) => s.Login)
        .and.returnValue(true);
    });
    it("can force the type to be different (any)", () => {
      mkr
        .Type(LoginService)
        .Mock<any>((s) => s.Login)
        .and.returnValue(3);
    });
    it("can still use a string based mock method", () => {
      mkr.Type(LoginService).Mock("login").and.returnValue(3);
    });
    it("can specify a typefor a string based mock", () => {
      mkr.Type(LoginService).Mock<boolean>("login").and.returnValue(true);
    });
    it("Can infer types in Type()", () => {
      mkr
        .Type(LoginService)
        .Mock((l) => l.Login)
        .and.returnValue(true);
    });
    it("Can infer types in Resolve", () => {
      const svc = mkr.Resolve(LoginService);
      expect(svc).toBeInstanceOf(LoginService);
    });
    it("Can use Set() to verify setters", () => {
      var setSpy = mkr.Type(LoginService).Set((s) => s.ServiceName);
      const svc = mkr.Resolve(LoginService);
      svc.ServiceName = "test";
      expect(setSpy).toHaveBeenCalledWith("test");
    });
    it("Can resolve a PureProxied type twice (checking)", () => {
      mkr.Isolate(LoginModel);
      const s1 = mkr.Resolve(LoginService);
      const s2 = mkr.Resolve(LoginService);
      expect(s1).not.toBeFalsy();
      expect(s2).not.toBeFalsy();
    });

    it("still allows spying on Isolated types", () => {
      mkr.Isolate(LoginModel);
      const spy = mkr
        .Type(LoginModel)
        .Mock((m) => m.GetServiceName)
        .and.callThrough();
      const svc = mkr.Resolve(LoginModel);
      svc.GetServiceName();
      expect(spy).toHaveBeenCalled();
    });
  });
});
