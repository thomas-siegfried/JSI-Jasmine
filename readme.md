# jsi.Jasmine

jsi.jasmine is an extension to the jsi library designed to facilitate unit testing with Jasmine and jsi. This utility exposes an AutoMocker, which can create mock objects for all dependencies, and also allows easy configuration of Mock objects using Jasmine spies and Proxy.

## Installing

```shell
npm i @thomas-siegfried/jsi.jasmine
```

## Usage

The AutoMocker class wraps an instance of Injector, allowing for the creation of Mock objects. Mock objects can easily be configured with Jasmine spies to verify or fake object interaction when unit testing.

Consider the following simple class model. A controller depends on two services. When our method is called, we first validate an authentication token, then update our database is the token is valid.

```typescript
@Inject
class Controller {
  constructor(private validator: ValidationService, private db: DbService) {}
  UpdateDatabase(userToken: string, data: any) {
    if (this.validator.validateToken(userToken)) {
      this.db.updateDatabase(data);
    }
  }
}
class ValidationService {
  validateToken(token: string): boolean;
}
class DbService {
  updateDatabase(data: any): void {}
}
```

Normally, we would have to create Mock versions of the dependencies and inject them into the controller in order to run tests.

```typescript
describe("Controller", () => {
  it("...", () => {
    var validator = createMockValidator();
    var db = createMockDb();
    var ctrl = new Constroller(validator, db);
    //run unit test
  });
});
```

### Mocks and Isolation

When unit testing, we generally want a to a single class, with other related classes being fakes.

AutoMocker can Isolate a given type. This type will be created normally by jsi, all other types will be created as mocks. The mock objects will by default return null from all methods and properties will be automatic, meaning they will retain any values they are set to in the test.

```typescript
mok: AutoMocker = new AutoMocker();
mok.Isolate(Controller);
mok.Resolve(Controller); //real object
mok.Resolve(ValidationService); //mock object
```

### Configure Mock Objects

Configure a Mock object using TypeMocker<T>. The Mock,Get,Set methods will return jasmine spies for the Methods and Properties of the type being mocked.

```typescript
mok: AutoMocker = new AutoMocker();
var tm = mok.Type<MyType>(MyType);
//setup method call
tm.Mock((c) => c.Method).and.returnValue("test");
//setup property getter
tm.Get((c) => c.Prop1).and.returnValue("prop1");
//capture spy for setter
var spy = tm.Set((c) => c.Prop1);
//all these methods return a jasmine spy
expect(spy).toHaveBeenCalled();
```

### Proxy Mock Objects

When the Auto Mocker creates Mock objects, it does not create an Instance of the mock dependency. Instead a Proxy is created, this means dependencies are never created, no constructor code is run. This helps to isolate the unit test from any code run in a different class.

### Sample Unit Test

```typescript
describe('Controller',()=>{
    it('requires validation',()=>{
        const mok:AutoMocker = new AutoMocker();
        //we are testing controller
        mok.Isolate(Controller);
        //validation returns false
        var validateSpy =mok.Type(ValidationService)
        .Mock(svc=>svc.validateToken)
        .and.returnValue(false);
        //spy on the updateDatabase method
        var updateSpy = mok.Type<DbService>(DbService).Mock(db=>db.updateDatabase);

        //resolve controller, injected with Mock objects
        const c = mok.Resolve(Controller);
        c.UpdateDatabase('',{});
        //should not have called update (because validator returned false)
        expect(updateSpy).not.toHaveBeenCalled();
        expect(validateSpy).toHaveBeenCalled();
})
```

## Configure Methods

In order to reduce the number of local variables in our unit tests, many of the AutoMocker methods have a configure function, allowing us to run multiple configuration steps on an object without declaring a variable for it. These methods are optional.

### Typemocker Setup Methods

A call to Type has an optional second parameter, a function with takes the TypeMocker<T> as an argument.

```typescript
describe("Controller", () => {
  const mok = new AutoMocker();
  mok.Isolate(Controller);

  mok.Type(ValidationService, (serviceMock) => {
    //perform multiple operations here, without creating a variable for the TypeMocker
    serviceMock.Get((m) => m.Property).and.returnValue({});
    serivceMock.Mock((m) => m.Method).and.returnValue(false);
  });
});
```

### Spy Setup Methods and Deferred Verification

Calls to Mock, Get, Set have an optional second parameter which is a function with two arguments. The first is the spy created by the method, which we can use to setup return values, the second is a verfication function which allows us to setup deferred verification calls. At the end of the unit test a call to AutoMocker.VerifyAll() will run all the deferred verification. Again, this is just to reduce the number of variables used in each unit test

```typescript
mok.Type(DbService, (mockDb) => {
  mockDb.Mock(
    (db) => db.UpdateDatabase,
    (spy, val) => {
      //configure the spy
      spy.and.returnValue({});
      val((ex) => ex.not.toHaveBeenCalled()); //setup verification to be run at the end of the test
    }
  );
});
// ... perform actions

mok.VerifyAll();
```
