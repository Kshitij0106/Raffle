const { assert, expect } = require("chai");
const { network, ethers, getNamedAccounts } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle", () => {
      let raffle, deployer, raffleEntranceFee;

      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;
        raffle = await ethers.getContract("Raffle", deployer);
        raffleEntranceFee = await raffle.getEntranceFees();
      });

      describe("Fullfill random words", () => {
        it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async () => {
          const startingTimeStamp = await raffle.getLastTimeStamp();
          const accounts = ethers.getSigners();

          await new Promise(async (resolve, reject) => {
            // setup listener before we enter the raffle
            // Just in case the blockchain moves REALLY fast

            raffle.once("WinnerSelected", async () => {
              try {
                const recentWinner = await raffle.getWinner();
                const raffleState = await raffle.getRaffleState();
                const endingTimeStamp = await raffle.getLastTimeStamp();
                const winnerEndingBalance = await accounts[0].getBalance();

                await expect(raffle.getPlayer(0)).to.be.reverted;
                assert.equal(recentWinner, accounts[0].address);
                assert.equal(raffleState, 0);
                assert(endingTimeStamp > startingTimeStamp);
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(raffleEntranceFee).toString()
                );
                resolve();
              } catch (error) {
                console.log(error);
                reject(error);
              }
            });

            // Then entering the raffle
            console.log("Entering Raffle...");
            const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
            await tx.wait(1);
            const winnerStartingBalance = await accounts[0].getBalance();
          });
        });
      });
    });
