const { assert, expect } = require('chai')
const { network, deployments, ethers } = require('hardhat')
const { developmentChains } = require('../../helper-hardhat-config')

!developmentChains.includes(network.name)
  ? describe.skip
  : describe('Random IPFS NFT Unit Tests', function () {
      let randomIpfsNft, deployer, vrfCoordinatorV2Mock

      beforeEach(async () => {
        accounts = await ethers.getSigners()
        deployer = accounts[0]
        await deployments.fixture(['mocks', 'randomipfs'])
        randomIpfsNft = await ethers.getContract('RandomIPFSNFT', deployer)
        vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock')
      })

      describe('constructorr', () => {
        it('sets starting values correctly', async function () {
          const TokenUriZero = await randomIpfsNft.getTokenUris(0)
          const isInitialized = await randomIpfsNft.getInitialized()
          assert(TokenUriZero.includes('ipfs://'))
          assert.equal(isInitialized, true)
        })
      })

      describe('requestNft', () => {
        it("fails if payment isn't sent with the request", async function () {
          await expect(randomIpfsNft.requestNFT()).to.be.reverted
        })
        it('reverts if payment amount is less than the mint fee', async function () {
          const fee = await randomIpfsNft.getMintFee()
          await expect(
            randomIpfsNft.requestNFT({
              value: fee.sub(ethers.utils.parseEther('0.001')),
            })
          ).to.be.reverted
        })
        it('emits an event and kicks off a random word request', async function () {
          const fee = await randomIpfsNft.getMintFee()
          await expect(
            randomIpfsNft.requestNFT({ value: fee.toString() })
          ).to.emit(randomIpfsNft, 'NftRequested')
        })
      })

      describe('fulfillRandomWords', () => {
        it('mints NFT after random number is returned', async function () {
          await new Promise(async (resolve, reject) => {
            randomIpfsNft.once('NftMinted', async () => {
              try {
                const tokenUri = await randomIpfsNft.tokenURI('0')
                const tokenCounter = await randomIpfsNft.getTokenCounter()
                assert.equal(tokenUri.toString().includes('ipfs://'), true)
                assert.equal(tokenCounter.toString(), '1')
                resolve()
              } catch (e) {
                console.log(e)
                reject(e)
              }
            })
            try {
              const fee = await randomIpfsNft.getMintFee()
              console.log(fee)
              const requestNftResponse = await randomIpfsNft.requestNFT({
                value: fee.toString(),
              })
              console.log(requestNftResponse)
              const requestNftReceipt = await requestNftResponse.wait(1)
              await vrfCoordinatorV2Mock.fulfillRandomWords(
                requestNftReceipt.events[1].args.requestID,
                randomIpfsNft.address
              )
              console.log(
                `woah : ${requestNftReceipt.events[1].args.requestID}`
              )
            } catch (e) {
              console.log(e)
              reject(e)
            }
          })
        })
      })
    })
