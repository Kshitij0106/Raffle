const { network, ethers, deployments, getNamedAccounts } = require("hardhat");
const { assert, expect } = require("chai");
const {
  networkConfig,
  developmentChains,
} = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle", () => {
      let Raffle, vrfCoordinator, raffleEntranceFee, interval;
      const chainId = network.config.chainId;
      const accounts = ethers.getSigners();

      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);

        Raffle = await ethers.getContract("Raffle", deployer);
        vrfCoordinator = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        );
        raffleEntranceFee = await Raffle.getEntranceFees();
        interval = await Raffle.getInterval();
      });

      describe("Constructor", () => {
        it("initializes the raffle correctly", async () => {
          const raffleState = await Raffle.getRaffleState();
          assert(raffleState.toString(), "0");
          assert(interval, toString(), networkConfig[chainId]["interval"]);
        });
      });

      describe("Enter raffle", () => {
        it("reverts if you don't pay enough", async () => {
          await expect(Raffle.enterRaffle()).to.be.revertedWith(
            "Raffle__NotEnoughEntranceETH"
          );
        });

        it("adds player to the list", async () => {
          await Raffle.enterRaffle({ value: raffleEntranceFee });
          const plyr = await Raffle.getPlayer(0);
          assert(plyr.toString(), deployer);
        });

        it("emits an event when player enters", async () => {
          await expect(
            Raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.emit(Raffle, "RaffleEnter");
        });

        it("doesn't allow to enter when raffle is calculating", async () => {
          await Raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);

          await Raffle.performUpkeep([]);

          await expect(
            Raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.be.revertedWith("Raffle__NotOpen");
        });
      });

      describe("Check upkeep", () => {
        it("returns false if people haven't send enough ETH", async () => {
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upKeepNeeded } = await Raffle.callStatic.checkUpkeep([]);
          assert(!upKeepNeeded);
        });

        it("returns false if raffle isn't open", async () => {
          await Raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          await Raffle.performUpkeep([]);

          const state = await Raffle.getRaffleState();
          const { upKeepNeeded } = await Raffle.callStatic.checkUpkeep([]);
          assert.equal(state.toString() == "1", upKeepNeeded == false);
        });

        it("returns false if time hasn't passed", async () => {
          await Raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() - 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upKeepNeeded } = await Raffle.callStatic.checkUpkeep([]);
          assert(!upKeepNeeded);
        });

        it("returns true if time has passed, has plyrs, eth and is open", async () => {
          await Raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upKeepNeeded } = await Raffle.callStatic.checkUpkeep([]);
          assert(upKeepNeeded);
        });
      });

      describe("Perform upkeep", () => {
        it("runs only when checkupkeep is true", async () => {
          await Raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const tx = await Raffle.performUpkeep([]);
          assert(tx);
        });

        it("reverts if checkupkeep is false", async () => {
          await expect(Raffle.performUpkeep([])).to.be.revertedWith(
            "Raffle__UpkeepNotNeeded"
          );
        });

        it("updates the raffle state and emits a request ID", async () => {
          await Raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const txResponse = await Raffle.performUpkeep([]);
          const txReceipt = await txResponse.wait(1);
          const requestId = txReceipt.events[1].args.requestId;
          const raffleState = await Raffle.getRaffleState();
          assert(requestId.toNumber() > 0);
          assert(raffleState == 1);
        });
      });

      describe("Fullfill random words", () => {
        beforeEach(async () => {
          await Raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
        });

        it("can be called after perform upkeep", async () => {
          await expect(
            vrfCoordinator.fulfillRandomWords(0, Raffle.address)
          ).to.be.revertedWith("nonexistent request");

          await expect(
            vrfCoordinator.fulfillRandomWords(1, Raffle.address)
          ).to.be.revertedWith("nonexistent request");
        });

        // it("picks a winner, resets, and sends money", async () => {
        //   const entrants = 3;
        //   const startingIndex = 1;

        //   for (let i = startingIndex; i < startingIndex + entrants; i++) {
        //     const accountConnectedRaffle = Raffle.connect(accounts[i]);
        //     await accountConnectedRaffle.enterRaffle({
        //       value: raffleEntranceFee,
        //     });
        //   }

        //   const startingTimeStamp = await Raffle.getLastTimeStamp();

        //   await new Promise(async (resolve, reject) => {
        //     Raffle.once("WinnerSelected", async () => {
        //       try {
        //         const winner = await Raffle.getWinner();
        //         console.log(winner);
        //         console.log(accounts[0].address);
        //         console.log(accounts[1].address);
        //         console.log(accounts[2].address);
        //         console.log(accounts[3].address);

        //         const raffleState = await Raffle.getRaffleState();
        //         const endingTimeStamp = await Raffle.getLastTimeStamp();
        //         const numOfPlyrs = await Raffle.getNumberOfPlayers();
        //         assert.equal(raffleState, 0);
        //         assert.equal(numOfPlyrs.toString(), "0");
        //         assert(endingTimeStamp > startingTimeStamp);
        //         resolve();
        //       } catch (e) {
        //         reject(e);
        //       }
        //     });

        //     // kicking off the event by mocking the chainlink keepers and vrf coordinator
        //     const tx = await Raffle.performUpkeep([]);
        //     const txReceipt = await tx.wait(1);
        //     await vrfCoordinator.fulfillRandomWords(
        //       txReceipt[1].events.args.requestId,
        //       Raffle.address
        //     );
        //   });
        // });
      });
    });
