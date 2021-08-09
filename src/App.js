import React, { Component } from "react";
import { render } from "react-dom";
import * as R from "ramda";
import JSBI from "jsbi";
import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";

import { abi_glass } from "./contracts/abi-glass";
import { abi_pcs_exchange } from "./contracts/abi-pcs-exchange";

const base_unit = 0.00001;
const glass_token_address = "0x9c9d4302a1a550b446401e56000f76bc761c3a33";
const pcs_glass_exchange_address = "0x78d55aEfdD7d58FC3a4B63C9aBb6147230396D63";
const pcs_bnb_exchange_address = "0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16";

export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const TWO = JSBI.BigInt(2)
export const THREE = JSBI.BigInt(3)
export const FIVE = JSBI.BigInt(5)
export const TEN = JSBI.BigInt(10)
export const _100 = JSBI.BigInt(100)
export const _998 = JSBI.BigInt(998)
export const _1000 = JSBI.BigInt(1000)

let	loop;

class App extends Component {
	constructor() {
		super();

		this.state = {
			bnb_price: 0,
			bnb_token: {
				decimals: 0,
			},
			bnb_exchange: null,
			glass_contract: null,
			glass_exchange: null,
			time_since: 0,
			total_fees: 0,
			total_supply: 0,
			token_price_bnb: 0,
			token_price_usd: 0,
			usd_price: 0,
			web3: null
		};
	}

	componentDidMount() {
		const init = async () => {
			const provider = await detectEthereumProvider();

			if (provider) {
				const _state = {};
				const web3 = new Web3(provider);

				_state.web3 = web3;
				_state.bnb_exchange = new web3.eth.Contract(abi_pcs_exchange, pcs_bnb_exchange_address);
				_state.glass_contract = new web3.eth.Contract(abi_glass, glass_token_address);
				_state.glass_exchange = new web3.eth.Contract(abi_pcs_exchange, pcs_glass_exchange_address);

				this.setState({
					...this.state,
					..._state,
				});
			}

			return true;
		};

		init()
			.then((result) => {
				console.log("result", result);

				setInterval(async () => {
					await this.buildStats();
				}, 7e3);
			})
			.catch((error) => {
				console.error(error);
			});
	}

	render() {
		const { bnb_price, time_since, token_price_bnb, token_price_usd, total_fees, total_supply, usd_price } = this.state;
		
		return (
			<React.Fragment>
				<div className="container">
					<div className="row">
						<div className="col-sm-12">
							<h2>BNB Price (USD): {usd_price}</h2>
							<h2>GLASS Total Supply: {total_supply}</h2>
							<h2>GLASS Circulating Supply: {total_supply - total_fees}</h2>
							<h2>GLASS Price (BNB): {token_price_bnb}</h2>
							<h2>GLASS Market Cap. (BNB): {total_supply * token_price_bnb}</h2>
							<h2>GLASS Price (USD): {token_price_usd}</h2>
							<h2>GLASS Market Cap. (USD): {total_supply * token_price_usd}</h2>
							<h2>GLASS Fees (GLASS): {total_fees}</h2>
							<hr />
							<h2>Burn Rate: {time_since > 0 ? total_fees / time_since : 0} GLASS/s</h2>
							<h2>GLASS APR: {total_supply > 0 ? ((total_fees / total_supply) * 100).toFixed(9) : 0}%</h2>
						</div>
					</div>
				</div>
			</React.Fragment>
		);
	}

	getInputAmount = (outputReserve, inputReserve, outputAmount) => {
		const numerator = JSBI.multiply(JSBI.multiply(inputReserve, outputAmount), _1000);
		const denominator = JSBI.multiply(JSBI.subtract(outputReserve, outputAmount), _998);
		const inputAmount = JSBI.add(JSBI.divide(numerator, denominator), ONE);


		console.log("inputAmount", inputAmount);
		return inputAmount;
	}

	buildStats = async () => {
		try {
			const _state = {};
			const { bnb_exchange, glass_contract, glass_exchange, web3 } = this.state;

			if (glass_contract) {
				const decimals = +(await glass_contract.methods.decimals().call()).toString();
				const decimals_uint = Math.pow(10, decimals);
				const total_supply_uint = +(await glass_contract.methods.totalSupply().call()).toString();
				const total_fees_uint = +(await glass_contract.methods.totalFees().call()).toString();

				_state.bnb_token = {
					decimals: decimals,
				};

				_state.total_supply = total_supply_uint / decimals_uint;
				_state.total_fees = total_fees_uint / decimals_uint;
			}

			if (glass_exchange) {
				const { bnb_token, bnb_price, usd_price } = this.state;

				if (bnb_price && bnb_token) {
					const glass_exchange_decimals = await glass_exchange.methods.decimals().call();
					const output_decimals = parseInt(bnb_token.decimals ? bnb_token.decimals.toString() : 0, 10);
					const token_decimals_uint = Math.pow(10, output_decimals);
					const exchange_decimals_uint = Math.pow(10, output_decimals);

					const glass_exchange_reserves = await glass_exchange.methods.getReserves().call();
					const output_reserve = BigInt(R.pathOr(0, [0], glass_exchange_reserves));
					const input_reserve = BigInt(R.pathOr(0, [1], glass_exchange_reserves));
					const input_amount_with_fee = BigInt(1e9);
					const numerator = input_amount_with_fee * output_reserve;
					const denominator = input_reserve + input_amount_with_fee;
					const tokens_output = numerator / denominator;

					_state.token_price_bnb = (new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 }).format((tokens_output.toString() / Math.floor(usd_price * exchange_decimals_uint)) / 1e10));
					_state.token_price_usd = (new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 }).format(_state.token_price_bnb * usd_price));
				}
			}

			if (bnb_exchange) {
				const bnb_exchange_decimals = await bnb_exchange.methods.decimals().call();
				const output_decimals = parseInt(bnb_exchange_decimals ? bnb_exchange_decimals.toString() : 0, 10);
				const spend_amount = Math.pow(10, output_decimals);

				const bnb_exchange_reserves = await bnb_exchange.methods.getReserves().call();

				let output_reserve = BigInt(R.pathOr(0, [0], bnb_exchange_reserves));
				let input_reserve = BigInt(R.pathOr(0, [1], bnb_exchange_reserves));
				let input_amount_with_fee = BigInt(spend_amount); // * 0.997;
				let numerator = input_amount_with_fee * output_reserve;
				let denominator = input_reserve + input_amount_with_fee;

				// const input = this.getInputAmount(+R.pathOr(0, [0], bnb_exchange_reserves), +R.pathOr(0, [1], bnb_exchange_reserves), 1e9);

				// console.log("input");
				// console.log("spend_amount", spend_amount);
				// console.log("output_reserve", output_reserve);
				// console.log("input_reserve", input_reserve);

				_state.bnb_price = (numerator / denominator).toString() / 1e18;

				numerator = input_amount_with_fee * input_reserve;
				denominator = output_reserve + input_amount_with_fee;

				_state.usd_price = (numerator / denominator).toString() / 1e18;
			}

			if (web3) {
				const launch_block = await web3.eth.getBlock(6772043);
				const time_launch = R.pathOr(0, ["timestamp"], launch_block);
				const time_now = Math.floor(Date.now() / 1e3);

				_state.time_since = time_now - time_launch;
			}

			this.setState({
				...this.state,
				..._state,
			});
		} catch (exception) {
			console.error(exception);
		}
	};
}

export default App;
