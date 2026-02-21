import React, { ReactNode } from 'react';
import DocumentTitle from 'react-document-title';
import { useTranslation } from 'react-i18next';
import { Trans } from 'react-i18next';
import { Link, RouteComponentProps, withRouter } from 'react-router-dom';

import Header from '@/js/components/header';
import routes from '@/js/utils/routes';

export const EmptyIllustration = ({ message }: { message: ReactNode }) => (
  <div className="slds-illustration slds-illustration_large">
    <div className="slds-m-vertical_xx-large slds-align_absolute-center">
      <img
        src="/static/images/empty-plot.png"
        alt=""
        style={{ maxHeight: '300px' }}
      />
    </div>
    <p className="slds-text-body_regular">{message}</p>
  </div>
);

const FourOhFour = ({
  message,
  history,
}: {
  message?: ReactNode;
} & RouteComponentProps) => {
  const { t } = useTranslation();

  return (
    <DocumentTitle title={`${t('404')} | ${window.SITE_NAME}`}>
      <>
        <Header history={history} />
        <EmptyIllustration
          message={
            message === undefined ? (
              <Trans i18nKey="pageCannotBeFound">
                That page cannot be found. Try the{' '}
                <Link to={routes.home()}>home page</Link>?
              </Trans>
            ) : (
              message
            )
          }
        />
      </>
    </DocumentTitle>
  );
};

export default withRouter(FourOhFour);
