import { List } from 'immutable'
import { AbiItem } from 'web3-utils'

import { getNetworkInfo } from 'src/config'
import generateBatchRequests from 'src/logic/contracts/generateBatchRequests'
import { getTokenInfos } from 'src/logic/tokens/store/actions/fetchTokens'
import { makeToken, Token } from 'src/logic/tokens/store/model/token'
import { ALTERNATIVE_TOKEN_ABI } from 'src/logic/tokens/utils/alternativeAbi'
import { web3ReadOnly as web3 } from 'src/logic/wallets/getWeb3'
import { BuildTx, isEmptyData } from 'src/logic/safe/store/actions/transactions/utils/transactionHelpers'
import { CALL } from 'src/logic/safe/transactions'
import { sameAddress } from 'src/logic/wallets/ethAddresses'

export const getEthAsToken = (balance: string | number): Token => {
  const { nativeCoin } = getNetworkInfo()
  return makeToken({
    ...nativeCoin,
    balance: {
      tokenBalance: balance.toString(),
    },
  })
}

export const isAddressAToken = async (tokenAddress: string): Promise<boolean> => {
  // SECOND APPROACH:
  // They both seem to work the same
  // const tokenContract = await getStandardTokenContract()
  // try {
  //   await tokenContract.at(tokenAddress)
  // } catch {
  //   return 'Not a token address'
  // }
  const call = await web3.eth.call({ to: tokenAddress, data: web3.utils.sha3('totalSupply()') as string })

  return call !== '0x'
}

export const isTokenTransfer = (tx: BuildTx['tx']): boolean => {
  return (
    !isEmptyData(tx.data) &&
    // Check if contains 'transfer' method code
    tx.data?.substring(0, 10) === '0xa9059cbb' &&
    Number(tx.value) === 0 &&
    tx.operation === CALL
  )
}

export const getERC20DecimalsAndSymbol = async (
  tokenAddress: string,
): Promise<{ decimals: number; symbol: string }> => {
  const tokenInfo = { decimals: 18, symbol: 'UNKNOWN' }
  try {
    const storedTokenInfo = await getTokenInfos(tokenAddress)

    if (!storedTokenInfo) {
      const [, tokenDecimals, tokenSymbol] = await generateBatchRequests<
        [undefined, string | undefined, string | undefined]
      >({
        abi: ALTERNATIVE_TOKEN_ABI as AbiItem[],
        address: tokenAddress,
        methods: ['decimals', 'symbol'],
      })
      return { decimals: Number(tokenDecimals), symbol: tokenSymbol ?? 'UNKNOWN' }
    }
    return { decimals: Number(storedTokenInfo.decimals), symbol: storedTokenInfo.symbol }
  } catch (err) {
    console.error(`Failed to retrieve token info for ERC20 token ${tokenAddress}`)
  }

  return tokenInfo
}

export type GetTokenByAddress = {
  tokenAddress: string
  tokens: List<Token>
}

type TokenFound = {
  balance: string | number
  decimals: string | number
}

/**
 * Finds and returns a Token object by the provided address
 * @param {string} tokenAddress
 * @param {List<Token>} tokens
 * @returns Token | undefined
 */
export const getBalanceAndDecimalsFromToken = ({ tokenAddress, tokens }: GetTokenByAddress): TokenFound | undefined => {
  const token = tokens?.find(({ address }) => sameAddress(address, tokenAddress))

  if (!token) {
    return
  }

  return {
    balance: token.balance.tokenBalance ?? 0,
    decimals: token.decimals ?? 0,
  }
}
