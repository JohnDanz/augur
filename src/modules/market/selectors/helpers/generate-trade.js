import memoizerific from 'memoizerific';
import { formatEther } from '../../../../utils/format-number';
import { abi } from '../../../../services/augurjs';

import { BUY, SELL } from '../../../trade/constants/types';
import { ZERO } from '../../../trade/constants/numbers';
import * as TRANSACTIONS_TYPES from '../../../transactions/constants/types';

import { updateTradesInProgress } from '../../../trade/actions/update-trades-in-progress';
import { makeTradeTransaction } from '../../../transactions/actions/add-trade-transaction';

import store from '../../../../store';

export const generateTrade = memoizerific(5)((market, outcome, outcomeTradeInProgress) => {
	const side = outcomeTradeInProgress && outcomeTradeInProgress.side || BUY;
	const numShares = outcomeTradeInProgress && outcomeTradeInProgress.numShares || 0;
	const limitPrice = outcomeTradeInProgress && outcomeTradeInProgress.limitPrice || (numShares ? 1 : 0);
	const totalFee = outcomeTradeInProgress && outcomeTradeInProgress.totalFee || 0;
	const totalCost = outcomeTradeInProgress && outcomeTradeInProgress.totalCost || 0;

	return {
		side,
		numShares,
		limitPrice,

		totalFee: formatEther(totalFee),
		totalCost: formatEther(totalCost),

		tradeTypeOptions: [
			{ label: BUY, value: BUY },
			{ label: SELL, value: SELL }
		],

		tradeSummary: generateTradeSummary(generateTradeOrders(market, outcome, outcomeTradeInProgress)),
		updateTradeOrder: (shares, limitPrice, side) => store.dispatch(updateTradesInProgress(market.id, outcome.id, side, shares, limitPrice))
	};
});

export const generateTradeSummary = memoizerific(5)((tradeOrders) => {
	let tradeSummary = { totalGas: ZERO, tradeOrders: [] };

	if (tradeOrders && tradeOrders.length) {
		tradeSummary = tradeOrders.reduce((p, tradeOrder) => {

			// total gas
			if (tradeOrder.gasEth && tradeOrder.gasEth.value) {
				p.totalGas = p.totalGas.plus(abi.bignum(tradeOrder.gasEth.value));
			}

			// trade order
			p.tradeOrders.push(tradeOrder);

			return p;

		}, tradeSummary);
	}

	tradeSummary.totalGas = formatEther(tradeSummary.totalGas);

	return tradeSummary;
});

export const generateTradeOrders = memoizerific(5)((market, outcome, outcomeTradeInProgress) => {
	const tradeActions = outcomeTradeInProgress && outcomeTradeInProgress.tradeActions;

	if (!market || !outcome || !outcomeTradeInProgress || !tradeActions || !tradeActions.length) {
		return [];
	}

	return tradeActions.map(tradeAction => (
		makeTradeTransaction(
			TRANSACTIONS_TYPES[tradeAction.action],
			market.id,
			outcome.id,
			market.type,
			market.description,
			outcome.name,
			tradeAction.shares,
			formatEther(tradeAction.avgPrice).formattedValue,
			Math.abs(parseFloat(tradeAction.costEth)),
			store.dispatch)
	));
});
