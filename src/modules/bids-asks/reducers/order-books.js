/*
 * Author: priecint
 */
import { UPDATE_MARKET_ORDER_BOOK } from '../../bids-asks/actions/update-market-order-book';

/**
 * @param {Object} orderBooks
 * @param {Object} action
 * @return {{}} key: marketId, value: {buy: [], sell: []}
 */
export default function (orderBooks = {}, action) {
	switch (action.type) {
	case UPDATE_MARKET_ORDER_BOOK:
		return {
			...orderBooks,
			[action.marketId]: action.marketOrderBook
		};
	default:
		return orderBooks;
	}
}
