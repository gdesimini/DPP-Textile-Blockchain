// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DigitalProductPassport {
    address public owner;

    struct Passport {
        string productId;
        string dataHash;    // Hash Keccak-256 dei dati normalizzati del passaporto
        uint256 timestamp;  // Data di registrazione On-Chain
    }

    mapping(string => Passport) private passports;

    event PassportNotarized(string indexed productId, string dataHash, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Solo il proprietario puo notarizzare");
        _;
    }

    function notarizePassport(string memory _productId, string memory _dataHash) public onlyOwner {
        passports[_productId] = Passport(_productId, _dataHash, block.timestamp);
        emit PassportNotarized(_productId, _dataHash, block.timestamp);
    }

    function getPassport(string memory _productId) public view returns (string memory dataHash, uint256 timestamp) {
        Passport memory p = passports[_productId];
        require(bytes(p.productId).length > 0, "Passaporto non trovato on-chain");
        return (p.dataHash, p.timestamp);
    }
}