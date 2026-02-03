import { passwordAuthService } from './server/services/password-auth-service';
import { emailService } from './server/services/email-service';

async function main() {
  const email = 'davidwmcintosh@yahoo.com';
  
  console.log('Creating invitation token...');
  const result = await passwordAuthService.createInvitation({
    email: email,
    firstName: 'David',
    lastName: 'McIntosh',
    role: 'student',
  }, '49847136'); // Admin ID (David's main account)
  
  if (!result.success || !result.token) {
    console.error('Failed to create invitation:', result.error);
    process.exit(1);
  }
  
  console.log('Sending invitation email...');
  const sent = await emailService.sendInvitation({
    to: email,
    firstName: 'David',
    inviterName: 'David McIntosh',
    role: 'student',
    token: result.token,
  });
  
  if (sent) {
    console.log('✓ Invitation email sent successfully to:', email);
  } else {
    console.error('Failed to send email');
    process.exit(1);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
