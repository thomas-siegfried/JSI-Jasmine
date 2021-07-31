# JS-Inject.Jasmine
js-inject.jasmine is an extension to the js-inject library designed to facilitate unit testing with Jasmine and JS-Inject.
## Installing
```shell
npm i js-inject.jasmine
```

## Usage
The AutoMocker class wraps an instance of Injector, allowing for the creation of Mock objects.  Mock objects can easily be configured with Jasmine spies to verify or fake object interaction when unit testing.

Consider the following simple class model. A controller depends on two services.  When our method is called, we first validate an authentication token, then update our database is the token is valid.

```typescript
@Inject
class Controller{
    constructor(private validator:ValidationService
    ,private db:DbService){}
    UpdateDatabase(userToken:string,data:any){
        if(this.validator.validateToken(userToken)){
            this.db.updateDatabase(data);
        }
    }
}
class ValidationService{
    validateToken(token:string):boolean;
}
class DbService{
    updateDatabase(data:any):void{};
}
```

### Stubs and Isolation
When unit testing, we generally want a to a single class, with other related classes being fakes.

AutoMocker can Isolate a given type. This type will be created normally by JS-Inject, all other types will be created as mocks.  The mock objects will by default return null from all methods and properties will be automatic, meaning they will retain any values they are set to in the test.

```typescript 
    mok:AutoMocker = new AutoMocker();
    mok.Isolate(Controller); 
    mok.Resolve<Controller>(Controller);//real object
    mok.Resolve<ValidationService>(ValidationService);//mock object   
```

### Configure Mock Objects
Configure a Mock object using TypeMocker<T>. The Mock,Get,Set methods will return jasmine spies for the Methods and Properties of the type being mocked.

```typescript 
    mok:AutoMocker = new AutoMocker();
    var tm = mok.Type<MyType>(MyType);
    tm.Mock(c=>c.Method).and.returnValue('test');
    tm.Get(c=>c.Prop1).and.returnValue('prop1');
    var spy = tm.Set(c=>c.Prop1);
    //all these methods return a jasmine spy
    expect(spy).toHaveBeenCalled();
```

### Pure Mock Objects
When mock objects are injected, they are still created by the JSI Injector, meaning dependencies are also creatd, and constructors are still run.  This is sometimes a problem we want to avoid.  A PureProxy solves this by registering a Object based on the prototype of the provided constructor function. The Mock can be configured as any other, but the object will not be created and no dependencies will be resolved

```typescript
    mok:AutoMocker = new AutoMocker();
    var tm = mok.Type<MyType>(MyType).PureProxy();
```

### Sample Unit Test
```typescript
describe('Controller',()=>{
    it('requires validation',()=>{
        mok:AutoMocker = new AutoMocker();
        mok.Isolate(Controller);    
        //validation returns false
        mok.Type<ValidationService>(ValidationService)
        .Mock(svc=>svc.validateToken)
        .and.returnValue(false);
        //spy on the updateDatabase method
        var updateSpy = mok.Type<DbService>(DbService).Mock(db=>db.updateDatabsae);

        //resolve controller, injected with Mock objects
        const c = mok.Resolve<Controller>(Controller);
        c.UpdateDatabase('',{});
        //should not have called update
        expect(updateSpy).not.toHaveBeenCalled();
})
```