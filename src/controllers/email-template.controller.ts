import { Body, Controller, Delete, Get, Header, Param, Post, Put, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateEmailTemplateDto } from '../dtos/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dtos/update-email-template.dto';
import { EmailTemplateService } from '../services/email-template.service';

// TODO: esInterop not working somehow, defaulted to using the require syntax to import Mailgen. Figure a better way to do this. 
import Mailgen = require('mailgen');


@Controller('email-template')
@ApiTags("Common")
export class EmailTemplateController {
  constructor(private readonly service: EmailTemplateService) { }

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateEmailTemplateDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.create(createDto, files);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateEmailTemplateDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = []) {
    return this.service.insertMany(createDtos, filesArray);
  }

  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateEmailTemplateDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files);
  }

  @ApiBearerAuth("jwt")
  @ApiQuery({ name: 'showSoftDeleted', required: false, type: Boolean })
  @ApiQuery({ name: 'showOnlySoftDeleted', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'fields', required: false, type: Array })
  @ApiQuery({ name: 'sort', required: false, type: Array })
  @ApiQuery({ name: 'groupBy', required: false, type: Array })
  @ApiQuery({ name: 'populate', required: false, type: Array })
  @ApiQuery({ name: 'populateMedia', required: false, type: Array })
  @ApiQuery({ name: 'filters', required: false, type: Array })
  @Get()
  async findMany(@Query() query: any) {
    return this.service.find(query);
  }

  @ApiBearerAuth("jwt")
  @Get(':id')
  async findOne(@Param('id') id: string, @Query() query: any) {
    return this.service.findOne(+id, query);
  }

  @ApiBearerAuth("jwt")
  @Delete('/bulk')
  async deleteMany(@Body() ids: number[]) {
    return this.service.deleteMany(ids);
  }

  @ApiBearerAuth("jwt")
  @Delete(':id')
  async delete(@Param('id') id: number) {
    return this.service.delete(id);
  }
 
  @ApiBearerAuth("jwt")
  @Get('mailgen-template/:templateType')
  @Header('content-type', 'text/html')
  generateMailgenTemplate(@Param('templateType') templateType: string) {
    const appName = process.env.SOLID_APP_NAME;
    const appUrl = process.env.SOLID_APP_WEBSITE_URL;

    // Configure mailgen by setting a theme and your product info
    var mailGenerator = new Mailgen({
      theme: 'default',
      product: {
        // Appears in header & footer of e-mails
        name: appName,
        link: appUrl
        // Optional product logo
        // logo: 'https://mailgen.js/img/logo.png'
      }
    });

    let email = null;
    if (templateType === 'otp-on-register') {
      email = {
        body: {
          name: 'John Appleseed',
          intro: `Welcome to ${appName}! We\'re very excited to have you on board.`,
          action: {
            instructions: `To get started with ${appName}, please verify your account using the below verification code.`,
            button: {
              color: '#22BC66', // Optional action button color
              text: `321455`,
              link: null
            }
          },
          outro: 'Need help, or have questions? Just reply to this email, we\'d love to help.'
        }
      };
    }
    if (templateType === 'otp-on-login') {
      email = {
        body: {
          name: 'John Appleseed',
          intro: `Welcome to ${appName}!`,
          action: {
            instructions: `Login to ${appName}, using the below verification code.`,
            button: {
              color: '#22BC66', // Optional action button color
              text: `321455`,
              link: null
            }
          },
          outro: 'Need help, or have questions? Just reply to this email, we\'d love to help.'
        }
      };
    }
    if (templateType === 'forgot-password') {
      email = {
        body: {
          name: 'John Appleseed',
          intro: `Welcome to ${appName}!`,
          action: {
            instructions: `Click on the below link to reset your password. Please note that this link will expire in 10 minutes.`,
            button: {
              color: '#22BC66', // Optional action button color
              text: `Reset Password`,
              link: `https://example.com`
            }
          },
          outro: 'Need help, or have questions? Just reply to this email, we\'d love to help.'
        }
      };
    }

    // Generate an HTML email with the provided contents
    var emailBody = mailGenerator.generate(email);

    // Generate the plaintext version of the e-mail (for clients that do not support HTML)
    // var emailText = mailGenerator.generatePlaintext(email);

    // Optionally, preview the generated HTML e-mail by writing it to a local file
    // require('fs').writeFileSync('preview.html', emailBody, 'utf8');

    // `emailBody` now contains the HTML body,
    // and `emailText` contains the textual version.
    //
    // It's up to you to send the e-mail.
    // Check out nodemailer to accomplish this:
    // https://nodemailer.com/
    return emailBody;
  }

}
