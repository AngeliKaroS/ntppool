package NP::Model::Monitor;
use v5.32.0;
use warnings qw(all);
use NP::Model::TokenID;
use base qw(NP::Model::TokenID);
use NP::Vault;
use Net::IP;

sub token_key_config {
    return 'monitor_id_key';
}

sub token_prefix {
    return 'mon-';
}

sub generate_tls_name {
    my $mon = shift;
    return $mon->tls_name if $mon->tls_name;
    warn "Setting up new tls name";
    my $domain   = NP::Vault->monitoring_tls_domain();
    my $tls_name = _choose_tls_name($mon->location, $mon->account->id_token, $domain);
    if ($tls_name) {
        warn "generated tls_name $tls_name";
        return $mon->tls_name($tls_name);
    }
    return undef;
}

sub _choose_tls_name {
    my ($location, $account_name, $domain) = @_;

    for my $n (1 .. 99) {
        my $name = $location . $n . "-" . $account_name . "." . $domain;
        my $mon  = NP::Model->monitor->fetch(tls_name => $name);
        unless ($mon) {
            return $name;
        }
    }
    return "";
}

sub has_api_role {
    my $self = shift;
    my $role = $self->vault_role_id();
    return 1 if $role;
    return 0;
}

sub vault_role_id {
    my $self    = shift;
    my $role_id = NP::Vault::get_monitoring_role_id($self->tls_name);
    return $role_id || undef;
}

sub setup_vault_role {
    my $self    = shift;
    my $role_id = $self->vault_role_id;
    return $role_id if $role_id;
    if (NP::Vault::setup_monitoring_role($self->tls_name)) {
        return $self->vault_role_id;
    }
    else {
        return undef;
    }
}

sub setup_vault_secret {
    my $self = shift;
    return NP::Vault::setup_monitoring_secret($self->tls_name);
}

sub can_generate_api_key {
    my $self = shift;
    return 1 if $self->status eq "testing" or $self->status eq "active";

    # =~ m/^(testing|live)$/);
    return 0;
}

sub can_edit {
    my ($self, $user) = @_;
    return 0 unless $user;
    return 1 if $user->privileges->support_staff;
    return 1 if grep { $_->id == $user->id } $self->account->users;
    return 0;
}

sub ip {
    my $self = shift;
    if (@_) {
        my $ip         = Net::IP->new($_[0]);
        my $ip_version = $ip->ip_is_ipv4 ? 'v4' : 'v6';
        $self->ip_version($ip_version);
        $_[0] = $ip->short;
    }
    return $self->_ip(@_);
}

sub validate {
    my $mon    = shift;
    my $errors = {};

    for my $f (qw(ip ip_version account_id)) {
        $errors->{$f} = 'Required field' unless $mon->$f and $mon->$f =~ m/\S/;
    }

    warn "MON LOCATION: ", $mon->location;
    unless ($mon->location) {
        warn "missing location?!";
        $errors->{location_code} = "Choose a location code";
    }

    $mon->{_validation_errors} = $errors;

    %$errors ? 0 : 1;
}

sub validation_errors {
    my $self = shift;
    $self->{_validation_errors} || {};
}

sub status_options {
    return qw(pending testing active paused deleted);
}

sub activate_monitor {
    my $self = shift;

    return unless $self->status eq 'active' or $self->status eq 'testing';

    my $dbh = NP::Model->dbh;

    $dbh->do(
        q[ insert ignore into server_scores (monitor_id, server_id, status, score_raw, created_on)
             select ?, id, ?, score_raw, NOW() from servers
             where ip_version = ? and deletion_on is null
         ], {}, $self->id, $self->status, $self->ip_version
    );

}

1;
