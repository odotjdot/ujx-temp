import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute, type CognitoUserSession } from 'amazon-cognito-identity-js'

function customerPool() {
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID
  if (!userPoolId || !clientId) throw new Error('Cognito customer pool env not configured')
  return new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId })
}

export async function signIn(email: string, password: string): Promise<CognitoUserSession> {
  const pool = customerPool()
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool })
    const auth = new AuthenticationDetails({ Username: email, Password: password })
    user.authenticateUser(auth, {
      onSuccess: (s) => resolve(s),
      onFailure: (err) => reject(err),
      newPasswordRequired: () => reject(new Error('NEW_PASSWORD_REQUIRED')),
    })
  })
}

export async function signUp(email: string, password: string, attributes: { given_name?: string; family_name?: string } = {}): Promise<void> {
  const pool = customerPool()
  const attrList: CognitoUserAttribute[] = [new CognitoUserAttribute({ Name: 'email', Value: email })]
  if (attributes.given_name) attrList.push(new CognitoUserAttribute({ Name: 'given_name', Value: attributes.given_name }))
  if (attributes.family_name) attrList.push(new CognitoUserAttribute({ Name: 'family_name', Value: attributes.family_name }))
  attrList.push(new CognitoUserAttribute({ Name: 'custom:role', Value: 'customer' }))
  return new Promise((resolve, reject) => { pool.signUp(email, password, attrList, [], (err) => err ? reject(err) : resolve()) })
}

export async function getCurrentSession(): Promise<CognitoUserSession | null> {
  const user = customerPool().getCurrentUser()
  if (!user) return null
  return new Promise((resolve) => { user.getSession((err: any, s: CognitoUserSession | null) => resolve(err ? null : s)) })
}

export function signOut(): void { customerPool().getCurrentUser()?.signOut() }