"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = void 0;
const common_1 = require("@nestjs/common");
const fs = require("fs");
const client_s3_1 = require("@aws-sdk/client-s3");
const common_config_1 = require("../config/common.config");
let FileService = class FileService {
    constructor(commonConfiguration) {
        this.commonConfiguration = commonConfiguration;
        this.s3Client = new client_s3_1.S3Client({
            region: this.commonConfiguration.awsS3Credentials.S3_AWS_REGION_NAME,
            credentials: {
                accessKeyId: this.commonConfiguration.awsS3Credentials.S3_AWS_ACCESS_KEY,
                secretAccessKey: this.commonConfiguration.awsS3Credentials.S3_AWS_SECRET_KEY,
            },
        });
    }
    readFile(filePath) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    }
    readImageFile(filePath) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    }
    writeFile(filePath, data) {
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, data, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }
    async copyFile(sourcePath, destinationPath) {
        try {
            const data = await this.readFile(sourcePath);
            await this.writeFile(destinationPath, data);
        }
        catch (error) {
            throw new Error(`Error copying file: ${error.message}`);
        }
    }
    deleteFile(filePath) {
        return new Promise((resolve, reject) => {
            fs.unlink(filePath, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }
    async copyToS3(filePath, ContentType, fileName, bucketName) {
        try {
            const data = await this.readImageFile(filePath);
            const params = {
                Bucket: bucketName,
                Key: fileName,
                Body: data,
                ContentType: ContentType,
            };
            const command = new client_s3_1.PutObjectCommand(params);
            const response = await this.s3Client.send(command);
            return fileName;
        }
        catch (error) {
            throw new Error(`Error copying file: ${error.message}`);
        }
    }
    async copyToS3WithPublic(filePath, ContentType, fileName, bucketName) {
        try {
            const data = await this.readImageFile(filePath);
            const params = {
                Bucket: bucketName,
                Key: fileName,
                Body: data,
                ContentType: ContentType,
                ACL: "public-read"
            };
            const command = new client_s3_1.PutObjectCommand(params);
            const response = await this.s3Client.send(command);
            return fileName;
        }
        catch (error) {
            throw new Error(`Error copying file: ${error.message}`);
        }
    }
    async deleteFromS3(fileName, bucketName) {
        const params = {
            Bucket: bucketName,
            Key: fileName
        };
        const command = new client_s3_1.DeleteObjectCommand(params);
        const response = await this.s3Client.send(command);
        return fileName;
    }
};
exports.FileService = FileService;
exports.FileService = FileService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(common_config_1.default.KEY)),
    __metadata("design:paramtypes", [void 0])
], FileService);
//# sourceMappingURL=file.service.js.map