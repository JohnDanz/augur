import {
	assert
} from 'chai';
import proxyquire from 'proxyquire';
import sinon from 'sinon';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import testState from '../../testState';

describe(`modules/app/actions/update-blockchain.js`, () => {
	proxyquire.noPreserveCache().noCallThru();
	const middlewares = [thunk];
	const mockStore = configureMockStore(middlewares);
	let state = Object.assign({}, testState, {
		blockchain: {
			currentBlockMillisSinceEpoch: 1461774253983,
			currentBlockNumber: 833339,
			currentPeriod: 20,
			isReportConfirmationPhase: true,
			reportPeriod: 18
		}
	});
	let store = mockStore(state);

	let mockAugurJS = { augur: { rpc: { blockNumber: () => {} } } };
	let mockCheckPeriod = { checkPeriod: () => {} };

	mockAugurJS.augur.getCurrentPeriod = sinon.stub().returns(20);
	mockAugurJS.augur.getCurrentPeriodProgress = sinon.stub().returns(52);
	sinon.stub(mockAugurJS.augur.rpc, 'blockNumber', (cb) => {
		cb('0x2710');
	});
	mockAugurJS.augur.getVotePeriod = sinon.stub().yields(19);
	mockAugurJS.augur.getVotePeriod.onCall(1).yields(15);
	mockAugurJS.augur.getVotePeriod.onCall(2).yields(18);
	sinon.stub(mockCheckPeriod, 'checkPeriod', (cb) => {
		return (dispatch, getState) => {
			const reportPeriod = 19;
			dispatch({ type: 'UPDATE_BLOCKCHAIN', data: { reportPeriod } });
			cb(null, reportPeriod);
		};
	});

	let action = proxyquire('../../../src/modules/app/actions/update-blockchain.js', {
		'../../../services/augurjs': mockAugurJS,
		'../../reports/actions/check-period': mockCheckPeriod
	});

	beforeEach(() => {
		store.clearActions();
		global.Date.now = sinon.stub().returns(12345);
	});

	afterEach(() => {
		store.clearActions();
		mockAugurJS.augur.rpc.blockNumber.reset();
		mockAugurJS.augur.getCurrentPeriod.reset();
		mockAugurJS.augur.getCurrentPeriodProgress.reset();
		mockCheckPeriod.checkPeriod.reset();
	});

	it('should update our local state to match blockchain if chain is up-to-date', () => {
		let mockCB = () => {
			store.dispatch({
				type: 'MOCK_CB_CALLED'
			})
		};
		let out = [{
			type: 'UPDATE_BLOCKCHAIN',
			data: {
				currentBlockNumber: 10000,
				currentBlockMillisSinceEpoch: 12345,
				currentPeriod: 20,
				isReportConfirmationPhase: true
			}
		}, {
			type: 'UPDATE_BLOCKCHAIN',
			data: { reportPeriod: 19 }
		}, {
			type: 'MOCK_CB_CALLED'
		}];

		store.dispatch(action.updateBlockchain(true, mockCB));

		assert(mockAugurJS.augur.rpc.blockNumber.calledOnce, `blockNumber wasn't called once as expected`);
		assert(mockAugurJS.augur.getVotePeriod.calledOnce, `getVotePeriod wasn't called once as expected`);
		assert.deepEqual(store.getActions(), out, `Didn't dispatch the expected actions`);
	});

	it(`should increment branch if the branch is behind`, () => {
		mockAugurJS.augur.getCurrentPeriodProgress = sinon.stub().returns(42);
		let mockCB = () => {
			store.dispatch({
				type: 'MOCK_CB_CALLED'
			})
		};
		let out = [{
			type: 'UPDATE_BLOCKCHAIN',
			data: {
				currentBlockNumber: 10000,
				currentBlockMillisSinceEpoch: 12345,
				currentPeriod: 20,
				isReportConfirmationPhase: false
			}
		}, {
			type: 'UPDATE_BLOCKCHAIN',
			data: { reportPeriod: 19 }
		}, {
			type: 'MOCK_CB_CALLED'
		}];
		store.dispatch(action.updateBlockchain(true, mockCB));
		assert(mockAugurJS.augur.rpc.blockNumber.calledOnce, `blockNumber wasn't called once as expected`);
		assert(mockAugurJS.augur.getVotePeriod.calledTwice, `getVotePeriod wasn't called twice (no reset) as expected`);
		assert(mockAugurJS.augur.getCurrentPeriod.calledOnce, `getCurrentPeriod wasn't called once as expected`);
		assert(mockAugurJS.augur.getCurrentPeriodProgress.calledOnce, `getCurrentPeriodProgress wasn't called once as expected`);
		assert(mockCheckPeriod.checkPeriod.calledOnce, `checkPeriod wasn't called once as expected`);
		assert.deepEqual(store.getActions(), out, `Didn't dispatch the correct actons`);
	});

	it(`should collect fees and reveal reports if we're in the second half of the reporting period`, () => {
		mockAugurJS.augur.getCurrentPeriodProgress = sinon.stub().returns(52);
		let mockCB = () => {
			store.dispatch({
				type: 'MOCK_CB_CALLED'
			})
		};
		let out = [{
			type: 'UPDATE_BLOCKCHAIN',
			data: {
				currentBlockNumber: 10000,
				currentBlockMillisSinceEpoch: 12345,
				currentPeriod: 20,
				isReportConfirmationPhase: true
			}
		}, {
			type: 'UPDATE_BLOCKCHAIN',
			data: { reportPeriod: 19 }
		}, {
			type: 'MOCK_CB_CALLED'
		}];
		store.dispatch(action.updateBlockchain(true, mockCB));
		assert(mockAugurJS.augur.rpc.blockNumber.calledOnce, `blockNumber wasn't called once as expected`);
		assert(mockAugurJS.augur.getVotePeriod.calledThrice, `getVotePeriod wasn't called three times (no reset) as expected`);
		assert(mockAugurJS.augur.getCurrentPeriod.calledOnce, `getCurrentPeriod wasn't called once as expected`);
		assert(mockAugurJS.augur.getCurrentPeriodProgress.calledOnce, `getCurrentPeriodProgress wasn't called once as expected`);
		assert.deepEqual(store.getActions(), out, `Didn't dispatch the correct actons`);
	});
});
