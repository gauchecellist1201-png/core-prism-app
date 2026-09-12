import { describe, it, expect } from 'vitest';
import { estimateCompanyOs, type PriceScope } from '../pricing';
const scope:PriceScope={employees:50,departments:1,agents:2,apis:1,sources:2,security:'standard',complexity:'standard'};
describe('scope estimate',()=>{
 it('prices a bounded scope and separates monthly cost',()=>{expect(estimateCompanyOs(scope)).toMatchObject({low:1440000,high:2160000,monthlyLow:300000});});
 it('does not reduce price when scope or security grows',()=>{const base=estimateCompanyOs(scope)!;expect(estimateCompanyOs({...scope,employees:100,security:'sso',departments:2})!.low).toBeGreaterThan(base.low);});
 it.each([NaN,Infinity,-1,1.5,100001])('rejects invalid counts %s',v=>expect(estimateCompanyOs({...scope,employees:v})).toBeNull());
 it('rejects missing and inherited policy names',()=>{expect(estimateCompanyOs({...scope,security:'toString' as PriceScope['security']})).toBeNull();});
});
