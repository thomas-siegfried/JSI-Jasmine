import {Injector} from '@thomas-siegfried/jsi';
const WILDCARD:string ='*';
export class AutoMocker{
    constructor(public injector:Injector=null){
        if(!this.injector){
            this.injector=new Injector();
        }
    }

    Resolve<T>(key:any){
        return this.injector.Resolve<T>(key);
    }

    ResolveT<T>(key:Constructor<T>){
        return this.injector.Resolve<T>(key);
    }
    //configure a type for auto prop behavior
    //we can set any property and get back the value we set
    AutoProp(key:any){
        var pxy =this.injector.Proxy(key);
        var autoObjMap = new Map();
        const getAutoObj = (obj)=>{
            if(!autoObjMap.has(obj)){
                autoObjMap.set(obj,{});
            }
            return autoObjMap.get(obj);
        }
        pxy.get(WILDCARD).instead((obj,prop)=>{
            return getAutoObj(obj)[prop];
        });
        pxy.set(WILDCARD).instead((obj,prop,val)=>{
            getAutoObj(obj)[prop]=val;
        });
    }

    //All of the objects methods and props will return null
    Stub(key:any,autoProp:boolean=false){ 
        var pxy = this.injector.Proxy(key);
        pxy.fn(WILDCARD).instead(()=>null);
        if(autoProp){
            //setup automatic properties
            this.AutoProp(key);
        } else{
            //setup stubbed properties
            pxy.get(WILDCARD).instead(()=>null);
            pxy.set(WILDCARD).instead(()=>{});
        }
    }

    //specific method will be a spy, returned to caller
    Mock(key:any,Method:string):jasmine.Spy{
        var spy = jasmine.createSpy();
        var pxy = this.injector.Proxy(key);
        pxy.fn(Method).instead((obj,name,args)=>spy(...args))
        return spy;
    }


    Type<T>(key:any):TypeMocker<T>{
        return new TypeMocker<T>(key,this);
    }
    
    TypeT<T>(key:Constructor<T>):TypeMocker<T>{
        return new TypeMocker<T>(key,this);
    }
    
    //override the get result of a specific property
    Get(key:any,prop:string):jasmine.Spy{
        var spy = jasmine.createSpy();
        var pxy = this.injector.Proxy(key);
        pxy.get(prop).instead(()=>spy());
        return spy;
    }

    Set(key:any,prop:string):jasmine.Spy{
        var spy = jasmine.createSpy();
        var pxy = this.injector.Proxy(key);
        pxy.set(prop).instead((t,p,v)=>spy(v));
        return spy;
    }

    Isolate(key:any|any[]){
        if(Array.isArray(key)){
            key.forEach(k=>this.injector.Proxy(k));
        }else{
            this.injector.Proxy(key);
        }
        this.Stub(WILDCARD,true);     //all methods return null
    }

}

export interface Func<T>{
    (t:T):any;
}
export interface Func2<T,K>{
    (t:T):K;
}

export class TypeMocker<T>{
    constructor(private key:any,private mocker:AutoMocker){
    }

    //All of the objects methods will return null;
    Stub(autoProp:boolean=false){
        this.mocker.Stub(this.key,autoProp);
        return this;
    }
    //mock a specific method, returns the spy, and thus breaks the fluency
    Mock(method:string|Func<T>):jasmine.Spy{
        return this.mocker.Mock(this.key,this.GetMember(method));
     
    }

    MockT<K>(method:(t:T)=>()=>K):jasmine.Spy<()=>K>{
        var fn =this.parseFunction(method);
        return this.mocker.Mock(this.key,this.GetMember(fn)) as jasmine.Spy<()=>K>; 
    }

    Get(prop:string|Func<T>):jasmine.Spy{
        return this.mocker.Get(this.key,this.GetMember(prop));
    }

    GetT<K>(prop:(t:T)=>K):jasmine.Spy<()=>K>{
        var fn =this.parseFunction(prop);
        return this.mocker.Get(this.key,this.GetMember(fn)) as jasmine.Spy<()=>K>; 
    }

    Set(prop:string|Func<T>):jasmine.Spy{
        return this.mocker.Set(this.key,this.GetMember(prop));
    }

    /*Do not create the object, return an instance based on prototype and stub all methods*/
    PureProxy(autoProp:boolean=false){
        this.mocker.injector.RegisterOptions({Key:this.key,Factory:()=>Object.create(this.key.prototype)});
        this.Stub(autoProp);
        return this;
    }

    private GetMember(member:string|Func<T>){
        if(typeof member=='string')
            return member;
        else
            return this.parseFunction(member);
    }

    //brute force attempt to pull a member from a function simillar to Expression in C#
    //expects functions in the form of d=>d.Xyz or (d)=>d.abc etc
    private parseFunction(fn:(i:any)=>any):string{
        let txt = fn.toString();
        let prm =txt.substring(0,txt.indexOf("=>")).replace(/[(|)]/g,'').trim();
        let rest = txt.substring(txt.indexOf('=>')+2).trim();
        let member= rest.substring(prm.length+1);
        return member;
    }
       
}

interface Constructor<T>{
    new (...args:any[]):T;
}