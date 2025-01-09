import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
import { Roles } from 'src/decorators/roles.decorator';
import { EmailTemplateService } from '../services/email-template.service';
import { CreateEmailTemplateDto } from '../dtos/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dtos/update-email-template.dto';
import { Public } from 'src/decorators/public.decorator';



// TODO: esInterop not working somehow, defaulted to using the require syntax to import Mailgen. Figure a better way to do this. 
// import { Mailgen } from 'mailgen';
import Mailgen = require('mailgen');


@Controller('email-templates')
@ApiTags("Common")
export class EmailTemplateController {
  constructor(private readonly emailTemplateService: EmailTemplateService) { }

  @ApiBearerAuth("jwt")
  @Roles('Admin')
  @Post()
  create(@Body() dto: CreateEmailTemplateDto) {
    return this.emailTemplateService.create(dto);
  }

  @ApiBearerAuth("jwt")
  @Roles('Admin')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @Get()
  findAll(@Query() paginationQuery: PaginationQueryDto) {
    return this.emailTemplateService.findAll(paginationQuery);
  }

  @ApiBearerAuth("jwt")
  @Roles('Admin')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.emailTemplateService.findOne(+id);
  }

  @ApiBearerAuth("jwt")
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmailTemplateDto) {
    return this.emailTemplateService.update(+id, dto);
  }

  @ApiBearerAuth("jwt")
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.emailTemplateService.remove(+id);
  }

  // /api/email-templates/mailgen-template/otp-template
  // @ApiBearerAuth("jwt")
  // @Roles('Admin')
  @Public()
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
