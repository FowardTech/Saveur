import React from 'react';
import {Image, ImageProps, ImageSourcePropType, StyleSheet} from 'react-native';
import {IconPack, IconProvider} from '@ui-kitten/components';
import {SvgProps} from 'react-native-svg';
import {Icons} from './icons';

const createIcon = (source: ImageSourcePropType): IconProvider<ImageProps> => {
  return {
    toReactElement: props => (
      <Image
        style={styles.icon}
        {...props}
        source={source}
        resizeMode="cover"
      />
    ),
  };
};

const styles = StyleSheet.create({
  icon: {
    width: 24,
    height: 24,
  },
});

const AssetIconsPack: IconPack<ImageProps | SvgProps> = {
  name: 'assets',
  icons: {
    addMore: createIcon(Icons.addMore),
    bookmark: createIcon(Icons.bookmark),
    bookmarkActive: createIcon(Icons.bookmarkActive),
    back: createIcon(Icons.back),
    calendar: createIcon(Icons.calendar),
    calendarActive: createIcon(Icons.calendarActive),
    camera: createIcon(Icons.camera),
    close: createIcon(Icons.close),
    comment: createIcon(Icons.comment),
    commentActive: createIcon(Icons.commentActive),
    currentLocation: createIcon(Icons.currentLocation),
    eyeOff: createIcon(Icons.eyeOff),
    eyeOn: createIcon(Icons.eyeOn),
    search: createIcon(Icons.search),
    searchActive: createIcon(Icons.searchActive),
    send: createIcon(Icons.send),
    setting: createIcon(Icons.setting),
    filter: createIcon(Icons.filter),
    photoLibrary: createIcon(Icons.photoLibrary),
    pinMap: createIcon(Icons.pinMap),
    option: createIcon(Icons.option),
    map: createIcon(Icons.map),
    more: createIcon(Icons.more),
    moreActive: createIcon(Icons.moreActive),
    trash: createIcon(Icons.trash),
    twitter: createIcon(Icons.twitter),
    facebook: createIcon(Icons.facebook),
    dollar: createIcon(Icons.dollar),
    minus: createIcon(Icons.minus),
    plus: createIcon(Icons.plus),
    tutoring: createIcon(Icons.tutoring),
    infant: createIcon(Icons.infant),
    junior: createIcon(Icons.junior),
    preSchool: createIcon(Icons.preSchool),
    toddler: createIcon(Icons.toddler),
    quote: createIcon(Icons.quote),
    bgCheck: createIcon(Icons.bgCheck),
    bgCheckEnhanced: createIcon(Icons.bgCheckEnhanced),
    vehicleCheck: createIcon(Icons.vehicleCheck),
    master: createIcon(Icons.master),
    radioActive: createIcon(Icons.radioActive),
    arrowRight: createIcon(Icons.arrowRight),
    plusImg: createIcon(Icons.plusImg),
    resetSearch: createIcon(Icons.resetSearch),
    onlineState: createIcon(Icons.onlineState),
    baby: createIcon(Icons.baby),
    babyActive: createIcon(Icons.baby_active),
    location16: createIcon(Icons.location16),
    premiumAcc: createIcon(Icons.premiumAcc),
    attach: createIcon(Icons.attach),
    call: createIcon(Icons.call),
    payment: createIcon(Icons.payment),
    videoOff: createIcon(Icons.videoOff),
    callOff: createIcon(Icons.callOff),
    videoOn: createIcon(Icons.videoOn),
    mute: createIcon(Icons.mute),
    interview: createIcon(Icons.interview),
    callSmall: createIcon(Icons.callSmall),
    messageSmall: createIcon(Icons.messageSmall),
    calendarRequest: createIcon(Icons.calendarRequest),
    time: createIcon(Icons.time),
    notification: createIcon(Icons.notification),
    stats: createIcon(Icons.stats),
    changeJob: createIcon(Icons.changeJob),
    myPost: createIcon(Icons.myPost),
    helpWhite: createIcon(Icons.helpWhite),
    share: createIcon(Icons.share),
    term: createIcon(Icons.term),
    darkMode: createIcon(Icons.darkMode),
    male: createIcon(Icons.male),
    female: createIcon(Icons.female),
    homeActive: createIcon(Icons.homeActive),
    home: createIcon(Icons.home),
    rateFull: createIcon(Icons.rateFull),
    hourlyRate: createIcon(Icons.hourlyRate),
    carePro: createIcon(Icons.carePro),
    edit: createIcon(Icons.edit),
    searchHistory: createIcon(Icons.searchHistory),
    petCare: createIcon(Icons.petCare),
    housekeeping: createIcon(Icons.housekeeping),
    specialNeeds: createIcon(Icons.specialNeeds),
    seniorCare: createIcon(Icons.seniorCare),
    instagram: createIcon(Icons.instagram),
    increase: createIcon(Icons.increase),
    like_comment: createIcon(Icons.like_comment),
    like_comment_active: createIcon(Icons.like_comment_active),
    first_aid: createIcon(Icons.first_aid),
    cpr: createIcon(Icons.cpr),
    add_plan: createIcon(Icons.add_plan),
    edit_full: createIcon(Icons.edit_full),
    handle: createIcon(Icons.handle),
    occasional: createIcon(Icons.occasional),
    one_time: createIcon(Icons.one_time),
    regular_schedule: createIcon(Icons.regular_schedule),
    nanny: createIcon(Icons.nanny),
    asap: createIcon(Icons.asap),
    add: createIcon(Icons.add),
    credit: createIcon(Icons.credit),
    cash: createIcon(Icons.cash),
    security: createIcon(Icons.security),
    edit_profile: createIcon(Icons.edit_profile),
  },
};
export default AssetIconsPack;
