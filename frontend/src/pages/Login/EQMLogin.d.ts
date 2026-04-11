type EQMLoginCredentials = {
  login: string;
  password: string;
};

type EQMLoginProps = {
  onLogin: (credentials: EQMLoginCredentials) => Promise<void> | void;
  version?: string;
  sessionExpired?: boolean;
};

declare function EQMLogin(props: EQMLoginProps): JSX.Element;

export default EQMLogin;
