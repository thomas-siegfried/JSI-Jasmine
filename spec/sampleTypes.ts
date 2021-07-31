
import {Inject} from '@thomas-siegfried/jsi';

export class Person{
    firstname:string;
    lastname:string;
    get fullname():string{
        return this.firstname + ' ' + this.lastname;
    }

    getFullName(){
        
        return this.firstname + ' ' + this.lastname;
    }
}

//service that does things that we dont want in a unit test
export class LoginService{
    Login(user:string,password:string):boolean{
        throw new Error('we want to avoid this');
    }

    Logout(){
        throw new Error('Logout Called');
    }

    ServiceName:string='LoginService';
}

export class LoginValidator{
    ShouldLogin(model:LoginModel){
        return model.username && model.password && model.username==model.password;
    }
}

export class ClassIDontWantToCreateInMyTest{
    constructor(){
        throw new Error('Dont call this');
    }
    ThrowError():number{
        throw new Error('Dont call this either');
    }
}

@Inject()
export class LoginModel{
    constructor(private svcLogin:LoginService,private validator:LoginValidator){

    }
    username:string;
    password:string;
    IsValid(){
        return !!this.username && !!this.password;
    }

    Submit():boolean{
        if(!this.IsValid()){
            return false
        }
        return this.svcLogin.Login(this.username,this.password);
    }

    SubmitWithExternalValidation():boolean{
        if(!this.validator.ShouldLogin(this)){
            return false;
        }
        return this.svcLogin.Login(this.username,this.password);
    }

    GetServiceName():string{
        return this.svcLogin.ServiceName;
    }
}