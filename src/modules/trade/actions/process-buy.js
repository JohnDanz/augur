import { formatEther, formatShares } from '../../../utils/format-number';
import { abi } from '../../../services/augurjs';
import { ZERO } from '../../trade/constants/numbers';
import { SUCCESS, FAILED } from '../../transactions/constants/statuses';
import { loadAccountTrades } from '../../../modules/my-positions/actions/load-account-trades';
import { updateTradeCommitLock } from '../../trade/actions/update-trade-commit-lock';
import { tradeRecursively } from '../../trade/actions/helpers/trade-recursively';
import { calculateBuyTradeIDs } from '../../trade/actions/helpers/calculate-trade-ids';
import { updateExistingTransaction } from '../../transactions/actions/update-existing-transaction';
import { addBidTransaction } from '../../transactions/actions/add-bid-transaction';

export function processBuy(transactionID, marketID, outcomeID, numShares, limitPrice, totalEthWithFee) {
	return (dispatch, getState) => {
		if (!limitPrice || !totalEthWithFee) {
			return dispatch(updateExistingTransaction(transactionID, { status: FAILED, message: `invalid limit price "${limitPrice}" or total "${totalEthWithFee}"` }));
		}

		// we track filled shares again here to keep track of the full total through the recursiveness of trading
		let filledShares = ZERO;

		dispatch(updateExistingTransaction(transactionID, { status: 'starting...', message: `buying ${formatShares(numShares).full} @ ${formatEther(limitPrice).full}` }));

		const { loginAccount } = getState();

		tradeRecursively(marketID, outcomeID, 0, totalEthWithFee, loginAccount.id, () => calculateBuyTradeIDs(marketID, outcomeID, limitPrice, getState().orderBooks, loginAccount.id),
			(data) => {
				const update = { status: `${data.status} buy...` };
				if (data.hash) update.hash = data.hash;
				dispatch(updateExistingTransaction(transactionID, update));
			},
			(res) => {
				filledShares = filledShares.plus(abi.bignum(res.filledShares));

				// update user's position
				dispatch(loadAccountTrades());

				dispatch(updateExistingTransaction(transactionID, { status: 'filling...', message: generateMessage(totalEthWithFee, res.remainingEth, filledShares) }));
			},
			(err, res) => {
				dispatch(updateTradeCommitLock(false));
				if (err) {
					return dispatch(updateExistingTransaction(transactionID, { status: FAILED, message: err.message }));
				}

				// update user's position
				dispatch(loadAccountTrades());

				filledShares = filledShares.plus(abi.bignum(res.filledShares));

				dispatch(updateExistingTransaction(transactionID, { status: SUCCESS, message: generateMessage(totalEthWithFee, res.remainingEth, filledShares) }));

				const sharesRemaining = abi.bignum(numShares).minus(filledShares);
				if (sharesRemaining > 0 && res.remainingEth > 0) {
					const transactionData = getState().transactionsData[transactionID];

					dispatch(addBidTransaction(
						transactionData.data.marketID,
						transactionData.data.outcomeID,
						transactionData.data.marketDescription,
						transactionData.data.outcomeName,
						sharesRemaining,
						limitPrice,
						res.remainingEth));
				}
			}
		);
	};
}

function generateMessage(totalEthWithFee, remainingEth, filledShares) {
	const filledEth = abi.bignum(totalEthWithFee).minus(abi.bignum(remainingEth));
	return `bought ${formatShares(filledShares).full} for ${formatEther(filledEth).full} (fees incl.)`;
}
