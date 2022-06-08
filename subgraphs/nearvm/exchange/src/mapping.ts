import { near, log, BigInt, json, JSONValueKind, BigDecimal } from "@graphprotocol/graph-ts";
import { User, Swap, Pair, LiquidityPosition } from "../generated/schema";
import { fill_pair, fill_transaction, fill_token } from "./utils";
import { FACTORY_ADDRESS } from "./helpers"


// PARSING ALL ACTIONS FROM startBlock
export function handleReceipt(receipt: near.ReceiptWithOutcome): void {
  const actions = receipt.receipt.actions;
  
  for (let i = 0; i < actions.length; i++) {
    handleAction(
      actions[i], 
      receipt.receipt, 
      receipt.block.header,
      receipt.outcome
      );
  }
}

// INDEXING DATAS
function handleAction(
  action: near.ActionValue,
  receipt: near.ActionReceipt,
  blockHeader: near.BlockHeader,
  outcome: near.ExecutionOutcome
): void {

  if (action.kind != near.ActionKind.FUNCTION_CALL) {
    log.info("Early return: {}", ["Not a function call"]);
    return;
  }
  
  let users = new User(receipt.signerId);
  const functionCall = action.toFunctionCall();

// SWAP FUNCTION CALL
  if (functionCall.methodName == "swap") {
    const receiptId = receipt.id.toHexString();

    let logs = new Swap(`${receiptId}`); // Initializing Swap entity

    if(outcome.logs[0]!= null){
      let rawString = outcome.logs[0]
      let splitString = rawString.split(' ')
      // Filling Swap entity
        logs.id = rawString;
        logs.action = splitString[0].toString()
        // Filling Transaction entity
          let transaction = fill_transaction(action, receipt, blockHeader, outcome)
        logs.transaction = transaction.id
        logs.timestamp = BigInt.fromU64(blockHeader.timestampNanosec/1000000000)
        // Filling Pair entity
        let pair = fill_pair(action, receipt, blockHeader, outcome);
        logs.pair = pair.id
        logs.sender = receipt.signerId // ATTENTION
        logs.from = receipt.signerId
        logs.to = receipt.receiverId
        logs.amount0In = BigInt.fromString(splitString[1])
        logs.amount1In = BigInt.fromString("0")
        logs.amount0Out = BigInt.fromString("0")
        logs.amount1Out = BigInt.fromString(splitString[4])
      logs.save()
    }

  } else {
    log.info("Not processed - FunctionCall is: {}", [functionCall.methodName]);
  }

// ADD_SIMPLE_POOL FUNCTION CALL
  // if (functionCall.methodName == "add_simple_pool") {
  //   let factory = new PangolinFactory(FACTORY_ADDRESS)

  //   if(outcome.logs[0]!= null){
  //     factory.pairCount = factory.pairCount + 1;
  //   }
  //   factory.save()
  // } else {
  //   log.info("Not processed - FunctionCall is: {}", [functionCall.methodName]);
  // }

// ADD_LIQUIDITY FUNCTION CALL
  if (functionCall.methodName == "add_liquidity") {
    const receiptId = receipt.id.toHexString();

    let liquidity = new LiquidityPosition(`${receiptId}`);
    if(outcome.logs[0]!= null){
      liquidity.id = receiptId;
      let pair = new Pair(`${receiptId}`); // Initializing Pair entity
      let rawString = outcome.logs[0]
      let splitString = rawString.split(' ')
      let token0 = fill_token(action, receipt, blockHeader, outcome, splitString[3].toString());
      let token1 = fill_token(action, receipt, blockHeader, outcome, splitString[6].toString());;
      pair.token0 = token0.id
      pair.token1 = token1.id
      pair.save()
      liquidity.pair = pair.id
      liquidity.liquidityTokenBalance = BigDecimal.fromString(splitString[7])
      liquidity.save()
    }
  } else {
    log.info("Not processed - FunctionCall is: {}", [functionCall.methodName]);
  }
  users.save();
}
