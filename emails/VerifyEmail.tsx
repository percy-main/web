import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface Props {
  imageBaseUrl: string;
  url: string;
  name: string;
}

export const VerifyEmail = ({ url, name, imageBaseUrl }: Props) => (
  <Html>
    <Head />
    <Preview>Percy Main Cricket and Sports Club - Verify Your Email</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src={`${imageBaseUrl}/club_logo.png`}
          width="100"
          height="100"
          alt="Percy Main Club Logo"
          style={logo}
        />
        <Text style={paragraph}>Hi {name},</Text>
        <Text style={paragraph}>
          Thanks for signing up to Percy Main Cricket and Sports Club.
        </Text>
        <Section style={btnContainer}>
          <Button style={button} href={url}>
            Verify Your Email
          </Button>
        </Section>
        <Text style={paragraph}>
          Best,
          <br />
          The Trustees
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Percy Main Cricket Club, St. Johns Terrace, North Shields, NE29 6HS
        </Text>
      </Container>
    </Body>
  </Html>
);

VerifyEmail.PreviewProps = {
  url: "http://localhost:4321",
  imageBaseUrl: "http://localhost:4321/images",
  name: "Alex",
} as Props;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
};

const logo = {
  margin: "0 auto",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
};

const btnContainer = {
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#5F51E8",
  borderRadius: "3px",
  color: "#fff",
  fontSize: "16px",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px",
};

const hr = {
  borderColor: "#cccccc",
  margin: "20px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
};

export default VerifyEmail;
